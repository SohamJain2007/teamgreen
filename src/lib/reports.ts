import crypto from 'node:crypto';
import { getDb } from './db';
import { haversineM } from './geo';
import { getWard, getWards } from './wards';
import type { Category, Status, Zone } from './constants';
import { DUPLICATE_RADIUS_M } from './constants';
import { getStorage } from './storage';

export type Report = {
  id: string;
  createdAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  locSource: 'gps' | 'pin';
  ward: number | null;
  wardAuto: boolean;
  category: Category | null;
  note: string | null;
  status: Status;
  photo: string;
  thumb: string;
  afterPhoto: string | null;
  afterThumb: string | null;
  acknowledgedAt: number | null;
  clearedAt: number | null;
  upvotes: number;
  spamFlags: number;
  hidden: boolean;
  isDemo: boolean;
};

type Row = Record<string, any>;
const toReport = (r: Row): Report => ({
  id: r.id,
  createdAt: r.created_at,
  lat: r.lat,
  lng: r.lng,
  accuracy: r.accuracy,
  locSource: r.loc_source,
  ward: r.ward,
  wardAuto: !!r.ward_auto,
  category: r.category,
  note: r.note,
  status: r.status,
  photo: r.photo,
  thumb: r.thumb,
  afterPhoto: r.after_photo,
  afterThumb: r.after_thumb,
  acknowledgedAt: r.acknowledged_at,
  clearedAt: r.cleared_at,
  upvotes: r.upvotes,
  spamFlags: r.spam_flags,
  hidden: !!r.hidden,
  isDemo: !!r.is_demo,
});

export const SPAM_HIDE_THRESHOLD = 3;

// Crockford-ish base32 without look-alikes; 8 chars ≈ 40 bits.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newId(): string {
  const b = crypto.randomBytes(8);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
}

/** Public list: hidden reports are never included. */
export function listPublic(): Report[] {
  return (getDb().prepare('SELECT * FROM reports WHERE hidden = 0 ORDER BY created_at DESC LIMIT 2000').all() as Row[]).map(toReport);
}
export function listAll(): Report[] {
  return (getDb().prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 2000').all() as Row[]).map(toReport);
}
export function getReport(id: string): Report | null {
  const r = getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id) as Row | undefined;
  return r ? toReport(r) : null;
}

export function nearbyOpen(lat: number, lng: number, radiusM = DUPLICATE_RADIUS_M) {
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.cos((lat * Math.PI) / 180));
  const rows = getDb()
    .prepare(
      `SELECT * FROM reports WHERE hidden = 0 AND status != 'cleared'
       AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`,
    )
    .all(lat - dLat, lat + dLat, lng - dLng, lng + dLng) as Row[];
  return rows
    .map((r) => ({ report: toReport(r), distanceM: haversineM(lat, lng, r.lat, r.lng) }))
    .filter((x) => x.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function insertReport(r: {
  id: string; createdAt: number; lat: number; lng: number; accuracy: number | null; locSource: 'gps' | 'pin';
  ward: number | null; wardAuto: boolean; category: Category | null; note: string | null;
  photo: string; thumb: string; status?: Status; afterPhoto?: string | null; afterThumb?: string | null;
  acknowledgedAt?: number | null; clearedAt?: number | null; upvotes?: number; isDemo?: boolean;
}) {
  getDb()
    .prepare(
      `INSERT INTO reports (id, created_at, lat, lng, accuracy, loc_source, ward, ward_auto, category, note, status,
        photo, thumb, after_photo, after_thumb, acknowledged_at, cleared_at, upvotes, is_demo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      r.id, r.createdAt, r.lat, r.lng, r.accuracy, r.locSource, r.ward, r.wardAuto ? 1 : 0, r.category, r.note,
      r.status ?? 'reported', r.photo, r.thumb, r.afterPhoto ?? null, r.afterThumb ?? null,
      r.acknowledgedAt ?? null, r.clearedAt ?? null, r.upvotes ?? 1, r.isDemo ? 1 : 0,
    );
}

/** Returns the new count, or null if this client already voted. */
export function addVote(id: string, kind: 'up' | 'spam', client: string): number | null {
  const db = getDb();
  const tx = db.transaction(() => {
    const res = db
      .prepare('INSERT OR IGNORE INTO votes (report_id, kind, client, created_at) VALUES (?,?,?,?)')
      .run(id, kind, client, Date.now());
    if (res.changes === 0) return null;
    if (kind === 'up') {
      db.prepare('UPDATE reports SET upvotes = upvotes + 1 WHERE id = ?').run(id);
      return (db.prepare('SELECT upvotes FROM reports WHERE id = ?').get(id) as Row).upvotes as number;
    }
    db.prepare('UPDATE reports SET spam_flags = spam_flags + 1 WHERE id = ?').run(id);
    db.prepare('UPDATE reports SET hidden = 1 WHERE id = ? AND spam_flags >= ?').run(id, SPAM_HIDE_THRESHOLD);
    return (db.prepare('SELECT spam_flags FROM reports WHERE id = ?').get(id) as Row).spam_flags as number;
  });
  return tx();
}

export async function deleteReport(id: string) {
  const r = getReport(id);
  if (!r) return;
  const st = getStorage();
  for (const k of [r.photo, r.thumb, r.afterPhoto, r.afterThumb]) if (k) await st.remove(k).catch(() => {});
  getDb().prepare('DELETE FROM reports WHERE id = ?').run(id);
  getDb().prepare('DELETE FROM votes WHERE report_id = ?').run(id);
}

// ---------- stats ----------
export type Stats = {
  total: number;
  open: number;
  cleared: number;
  avgDaysToClear: number | null;
  oldestOpen: Report | null;
};
const DAY = 86_400_000;

export function computeStats(rs: Report[]): Stats {
  const open = rs.filter((r) => r.status !== 'cleared');
  const cleared = rs.filter((r) => r.status === 'cleared' && r.clearedAt);
  const avg = cleared.length ? cleared.reduce((s, r) => s + (r.clearedAt! - r.createdAt), 0) / cleared.length / DAY : null;
  const oldest = open.length ? open.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b)) : null;
  return { total: rs.length, open: open.length, cleared: cleared.length, avgDaysToClear: avg, oldestOpen: oldest };
}

export function wardStatsAll(rs: Report[]) {
  return getWards().map((w) => ({ ward: w, stats: computeStats(rs.filter((r) => r.ward === w.wardNumber)) }));
}
export function zoneStatsAll(rs: Report[]) {
  const zones = ['West', 'North', 'South', 'East'] as Zone[];
  return zones.map((z) => {
    const nums = new Set(getWards().filter((w) => w.zone === z).map((w) => w.wardNumber));
    return { zone: z, wardCount: nums.size, stats: computeStats(rs.filter((r) => r.ward != null && nums.has(r.ward))) };
  });
}

export function zoneOf(wardNumber: number | null): Zone | null {
  return wardNumber == null ? null : (getWard(wardNumber)?.zone ?? null);
}
