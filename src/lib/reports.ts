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
  verifiedAt: number | null;
  clearedBy: 'admin' | 'citizen' | null;
  reopenFlags: number;
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
  verifiedAt: r.verified_at ?? null,
  clearedBy: r.cleared_by ?? null,
  reopenFlags: r.reopen_flags ?? 0,
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
  contactEmail?: string | null; contactPhone?: string | null;
}) {
  getDb()
    .prepare(
      `INSERT INTO reports (id, created_at, lat, lng, accuracy, loc_source, ward, ward_auto, category, note, status,
        photo, thumb, after_photo, after_thumb, acknowledged_at, cleared_at, upvotes, is_demo, contact_email, contact_phone)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      r.id, r.createdAt, r.lat, r.lng, r.accuracy, r.locSource, r.ward, r.wardAuto ? 1 : 0, r.category, r.note,
      r.status ?? 'reported', r.photo, r.thumb, r.afterPhoto ?? null, r.afterThumb ?? null,
      r.acknowledgedAt ?? null, r.clearedAt ?? null, r.upvotes ?? 1, r.isDemo ? 1 : 0, r.contactEmail ?? null, r.contactPhone ?? null,
    );
}

/** Reporter's private contact details. Kept out of Report so they can never leak into public pages or API responses. */
export function getContact(id: string): { email: string | null; phone: string | null } {
  const r = getDb().prepare('SELECT contact_email, contact_phone FROM reports WHERE id = ?').get(id) as Row | undefined;
  return { email: r?.contact_email ?? null, phone: r?.contact_phone ?? null };
}

/** The reporter already counts as upvote 1; record their vote so they cannot also confirm (and verify) their own report. */
export function recordReporterVote(id: string, client: string) {
  getDb().prepare("INSERT OR IGNORE INTO votes (report_id, kind, client, created_at) VALUES (?, 'up', ?, ?)").run(id, client, Date.now());
}

/** Returns the new count, or null if this client already voted. Upvotes ("I see this too") are confirmations. */
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
  getDb().prepare('DELETE FROM events WHERE report_id = ?').run(id);
  getDb().prepare('DELETE FROM notifications WHERE report_id = ?').run(id);
}

// ---------- stats ----------
export type Stats = {
  total: number;
  open: number;
  cleared: number;
  avgDaysToClear: number | null;
  /** Verified -> first official action (acknowledged or cleared by admin). */
  avgDaysToRespond: number | null;
  verified: number;
  /** Average age in days of the spots that are still unresolved ("average wait time"). */
  avgOpenDays: number | null;
  oldestOpen: Report | null;
};
const DAY = 86_400_000;

export function computeStats(rs: Report[], now = Date.now()): Stats {
  const open = rs.filter((r) => r.status !== 'cleared');
  const cleared = rs.filter((r) => r.status === 'cleared' && r.clearedAt);
  const avg = cleared.length ? cleared.reduce((s, r) => s + (r.clearedAt! - r.createdAt), 0) / cleared.length / DAY : null;
  const oldest = open.length ? open.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b)) : null;
  const responded = rs
    .filter((r) => r.verifiedAt != null)
    .map((r) => {
      const acted = [r.acknowledgedAt, r.clearedBy === 'admin' ? r.clearedAt : null].filter((x): x is number => x != null);
      return acted.length ? Math.max(0, Math.min(...acted) - r.verifiedAt!) : null;
    })
    .filter((x): x is number => x != null);
  const avgResp = responded.length ? responded.reduce((a, b) => a + b, 0) / responded.length / DAY : null;
  return {
    total: rs.length, open: open.length, cleared: cleared.length, avgDaysToClear: avg, avgDaysToRespond: avgResp,
    verified: rs.filter((r) => r.verifiedAt != null).length, oldestOpen: oldest,
    avgOpenDays: open.length ? open.reduce((sum, r) => sum + (now - r.createdAt), 0) / open.length / DAY : null,
  };
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

// ---------- events, verification, citizen clean-up ----------
export type EventKind = 'reported' | 'confirmed' | 'verified' | 'notified' | 'escalated' | 'acknowledged' | 'cleared' | 'still_dirty' | 'reopened';
export type ReportEvent = { at: number; kind: EventKind; detail: string | null };

export function addEvent(reportId: string, kind: EventKind, detail: string | null = null, at = Date.now()) {
  getDb().prepare('INSERT INTO events (report_id, at, kind, detail) VALUES (?,?,?,?)').run(reportId, at, kind, detail);
}
export function listEvents(reportId: string): ReportEvent[] {
  return getDb().prepare('SELECT at, kind, detail FROM events WHERE report_id = ? ORDER BY at, id').all(reportId) as ReportEvent[];
}

/** Confirmations = people other than the reporter (upvotes start at 1 for the reporter). */
export const confirmations = (r: Report) => Math.max(0, r.upvotes - 1);

/** Marks the report verified once it has enough confirmations. Returns true only on the transition. */
export function maybeVerify(id: string, needed: number, force = false): boolean {
  const res = getDb()
    .prepare(`UPDATE reports SET verified_at = ? WHERE id = ? AND verified_at IS NULL AND hidden = 0 AND (? OR upvotes - 1 >= ?)`)
    .run(Date.now(), id, force ? 1 : 0, needed);
  if (res.changes === 0) return false;
  addEvent(id, 'verified', force ? 'admin' : null);
  return true;
}

export function markCleared(id: string, by: 'admin' | 'citizen', after?: { photo: string; thumb: string }) {
  const db = getDb();
  const now = Date.now();
  if (after) db.prepare('UPDATE reports SET after_photo=?, after_thumb=? WHERE id=?').run(after.photo, after.thumb, id);
  // Acknowledged timestamp is back-filled only for admin clears, so a citizen clean-up never fakes an official response.
  db.prepare(
    `UPDATE reports SET status='cleared', cleared_at=?, cleared_by=?, reopen_flags=0,
       acknowledged_at = CASE WHEN ? = 'admin' THEN COALESCE(acknowledged_at, ?) ELSE acknowledged_at END WHERE id=?`,
  ).run(now, by, by, now, id);
  db.prepare("DELETE FROM votes WHERE report_id=? AND kind='dirty'").run(id);
  addEvent(id, 'cleared', by);
}

/** "Still dirty" vote on a cleared report. Reopens it at the threshold. Returns null if already voted. */
export function addStillDirty(id: string, client: string, threshold: number): { flags: number; reopened: boolean } | null {
  const db = getDb();
  return db.transaction(() => {
    const ins = db.prepare("INSERT OR IGNORE INTO votes (report_id, kind, client, created_at) VALUES (?, 'dirty', ?, ?)").run(id, client, Date.now());
    if (ins.changes === 0) return null;
    db.prepare('UPDATE reports SET reopen_flags = reopen_flags + 1 WHERE id = ?').run(id);
    const flags = (db.prepare('SELECT reopen_flags FROM reports WHERE id = ?').get(id) as Row).reopen_flags as number;
    addEvent(id, 'still_dirty');
    if (flags < threshold) return { flags, reopened: false };
    reopen(id, 'citizens');
    return { flags, reopened: true };
  })();
}

export function reopen(id: string, by: string) {
  const db = getDb();
  db.prepare("UPDATE reports SET status='reported', cleared_at=NULL, cleared_by=NULL, reopen_flags=0 WHERE id=?").run(id);
  db.prepare("DELETE FROM votes WHERE report_id=? AND kind='dirty'").run(id);
  addEvent(id, 'reopened', by);
}

/** Deletes every demo report (and its photos). */
export async function clearDemo(): Promise<number> {
  const ids = (getDb().prepare('SELECT id FROM reports WHERE is_demo = 1').all() as Row[]).map((r) => r.id as string);
  for (const id of ids) await deleteReport(id);
  return ids.length;
}

// ---------- severity ----------
export type Severity = 'critical' | 'moderate' | 'minor';
/**
 * How urgent an unresolved spot is, from how long it has been open, how many people have seen it and what it is.
 * critical: open 30+ days, 6+ people, or burning waste / dead animal; moderate: open 7+ days, 3+ people, drain or debris.
 */
export function severity(r: Report, now = Date.now()): Severity {
  const days = (now - r.createdAt) / DAY;
  if (days >= 30 || r.upvotes >= 6 || r.category === 'burning' || r.category === 'dead_animal') return 'critical';
  if (days >= 7 || r.upvotes >= 3 || r.category === 'drain' || r.category === 'construction') return 'moderate';
  return 'minor';
}
