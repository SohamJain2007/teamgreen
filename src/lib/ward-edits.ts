/**
 * Editing ward and official data from /admin. Edits are stored as patches in data_overrides (on the volume) and applied
 * over data/wards.json by src/lib/wards.ts, so they take effect at once and survive redeploys. Only fields that differ
 * from the file are kept, so setting a value back to the original removes the edit.
 */
import { getDb } from './db';
import { audit } from './admins';
import { normEmail, normPhone } from './contact';
import { ZONES } from './constants';
import { inRanchi } from './geo';
import { fmtDate } from './format';
import { getWardFile, loadRaw, wardEditsChanged, type EscalationRole, type WardFile } from './wards';
import { councillorMobile, notifyMode } from './notify';

type FieldKind = 'text' | 'required' | 'longtext' | 'mobiles' | 'mobile' | 'phone' | 'email' | 'zone' | 'assembly' | 'bool' | 'coord';
type EntityKind = 'ward' | 'escalation' | 'official' | 'rep' | 'helpline' | 'assembly';

const SCHEMAS: Record<EntityKind, Record<string, FieldKind>> = {
  ward: {
    councillorName: 'text',
    councillorPhone: 'mobiles',
    councillorEmail: 'email',
    zone: 'zone',
    name: 'text',
    area: 'longtext',
    assembly: 'assembly',
    lat: 'coord',
    lng: 'coord',
    verified: 'bool',
  },
  escalation: { name: 'text', email: 'email', phone: 'mobile', verified: 'bool' },
  official: { name: 'text', phone: 'phone', verified: 'bool' },
  rep: { name: 'required', party: 'text', phone: 'phone' },
  helpline: { phone: 'phone', email: 'email' },
  assembly: { verified: 'bool' },
};

export const ESCALATION_ROLES: EscalationRole[] = ['commissioner', 'sdo', 'dc'];
const ESCALATION_TITLES: Record<EscalationRole, string> = {
  commissioner: 'Municipal Commissioner, Ranchi Municipal Corporation',
  sdo: 'Sub-Divisional Officer (SDO), Ranchi Sadar',
  dc: 'Deputy Commissioner (DC), Ranchi',
};

export type EditError = 'not_found' | 'bad_key' | 'bad_phone' | 'bad_email' | 'bad_zone' | 'bad_assembly' | 'bad_location' | 'required';

function kindOf(key: string): EntityKind | null {
  if (key === 'meta:helpline') return 'helpline';
  if (key === 'meta:assembly') return 'assembly';
  const k = key.split(':')[0];
  return k === 'ward' || k === 'escalation' || k === 'official' || k === 'rep' ? k : null;
}

/** The entity behind a key in a ward file (merged or raw), as a flat record, or undefined if it does not exist. */
function entity(file: WardFile, key: string): Record<string, unknown> | undefined {
  const id = key.split(':')[1];
  switch (kindOf(key)) {
    case 'ward':
      return file.wards.find((w) => !w.placeholder && w.wardNumber === Number(id));
    case 'escalation':
      if (!ESCALATION_ROLES.includes(id as EscalationRole)) return undefined;
      return file.escalation?.[id as EscalationRole] ?? { title: ESCALATION_TITLES[id as EscalationRole], name: null, email: null, phone: null, verified: false };
    case 'official':
      return file.rmcOfficials.find((o) => o.role === id);
    case 'rep': {
      const r = file.representatives;
      return r && (r.mp.slug === id ? r.mp : r.mlas.find((m) => m.slug === id));
    }
    case 'helpline':
      return file.meta.rmcHelpline;
    case 'assembly':
      return file.representatives ? { verified: file.representatives.assemblyMappingVerified } : undefined;
    default:
      return undefined;
  }
}

/** Normalises one submitted value, or returns why it is not acceptable. */
function normalise(kind: FieldKind, raw: unknown, file: WardFile): { value: unknown } | { error: EditError } {
  if (kind === 'bool') return { value: raw === true || raw === 'true' };
  if (kind === 'coord') {
    if (raw === null || raw === '') return { value: null };
    const n = Number(raw);
    return Number.isFinite(n) ? { value: Math.round(n * 1e6) / 1e6 } : { error: 'bad_location' };
  }
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return kind === 'required' ? { error: 'required' } : { value: null };
  switch (kind) {
    case 'text':
    case 'required':
      return { value: s.slice(0, 120) };
    case 'longtext':
      return { value: s.slice(0, 400) };
    case 'email':
      return normEmail(s) ? { value: normEmail(s) } : { error: 'bad_email' };
    case 'mobile':
      return normPhone(s) ? { value: normPhone(s) } : { error: 'bad_phone' };
    case 'mobiles': {
      // Councillors sometimes have two numbers, written "a / b"; SMS goes to the first.
      const parts = s.split('/').map((p) => normPhone(p));
      return parts.every(Boolean) ? { value: parts.join(' / ') } : { error: 'bad_phone' };
    }
    case 'phone':
      // Officials and the helpline may have landlines or toll-free numbers, which are shown, never texted.
      return /^[0-9+()\- ]{6,20}$/.test(s) && /\d{6,}/.test(s.replace(/\D/g, '')) ? { value: s } : { error: 'bad_phone' };
    case 'zone':
      return (ZONES as readonly string[]).includes(s) ? { value: s } : { error: 'bad_zone' };
    case 'assembly':
      return file.representatives?.mlas.some((m) => m.slug === s) ? { value: s } : { error: 'bad_assembly' };
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const show = (v: unknown) => (v == null || v === '' ? '(empty)' : String(v));

/** Human label for the activity log. */
function labelOf(key: string, file: WardFile): string {
  const id = key.split(':')[1];
  switch (kindOf(key)) {
    case 'ward':
      return `Ward ${id}`;
    case 'escalation':
      return `Escalation: ${id.toUpperCase()}`;
    case 'official':
      return String(entity(file, key)?.title ?? id);
    case 'rep':
      return String(entity(file, key)?.name ?? id);
    case 'helpline':
      return 'RMC helpline';
    default:
      return 'MLA ward list';
  }
}

export type SaveResult = { ok: true; changed: number } | { ok: false; error: EditError; field?: string };

export function saveEdit(key: string, input: Record<string, unknown>, admin: { id: number; name: string }): SaveResult {
  const kind = kindOf(key);
  if (!kind) return { ok: false, error: 'bad_key' };
  const merged = getWardFile();
  const current = entity(merged, key);
  if (!current) return { ok: false, error: 'not_found' };
  const original = entity(loadRaw(), key) ?? {};
  const schema = SCHEMAS[kind];

  const changes: Record<string, unknown> = {};
  for (const [field, fk] of Object.entries(schema)) {
    if (!(field in input)) continue;
    const r = normalise(fk, input[field], merged);
    if ('error' in r) return { ok: false, error: r.error, field };
    if (!same(r.value, current[field])) changes[field] = r.value;
  }
  // A map location is both coordinates or neither, and inside Ranchi.
  if ('lat' in changes || 'lng' in changes) {
    const lat = 'lat' in changes ? changes.lat : current.lat;
    const lng = 'lng' in changes ? changes.lng : current.lng;
    if ((lat == null) !== (lng == null) || (lat != null && !inRanchi(lat as number, lng as number))) return { ok: false, error: 'bad_location', field: 'lat' };
    changes.centroidSource = lat == null ? null : `set on the map in /admin by ${admin.name}, ${fmtDate(Date.now(), 'en', false)}`;
  }
  if (!Object.keys(changes).length) return { ok: true, changed: 0 };

  const db = getDb();
  const row = db.prepare('SELECT patch FROM data_overrides WHERE key = ?').get(key) as { patch: string } | undefined;
  const patch: Record<string, unknown> = { ...(row ? JSON.parse(row.patch) : {}), ...changes };
  for (const f of Object.keys(patch)) if (same(patch[f], original[f])) delete patch[f];
  // The note about where the location came from only belongs with an edited location.
  if (!('lat' in patch) && !('lng' in patch)) delete patch.centroidSource;
  if (Object.keys(patch).length) {
    db.prepare(
      'INSERT INTO data_overrides (key, patch, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET patch = excluded.patch, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
    ).run(key, JSON.stringify(patch), Date.now(), admin.id);
  } else db.prepare('DELETE FROM data_overrides WHERE key = ?').run(key);
  wardEditsChanged();

  const detail = Object.entries(changes)
    .filter(([f]) => f !== 'centroidSource')
    .map(([f, v]) => `${f}: ${show(current[f])} → ${show(v)}`)
    .join('; ');
  audit(admin.id, 'data_edit', null, `${labelOf(key, merged)}: ${detail}`);
  return { ok: true, changed: Object.keys(changes).length };
}

/** Drops every admin edit to one entity, back to the values in wards.json. */
export function resetEdit(key: string, adminId: number): boolean {
  const res = getDb().prepare('DELETE FROM data_overrides WHERE key = ?').run(key);
  if (!res.changes) return false;
  wardEditsChanged();
  audit(adminId, 'data_reset', null, labelOf(key, getWardFile()));
  return true;
}

export type EditInfo = { at: number; by: string | null; fields: string[] };
export function listEdits(): Record<string, EditInfo> {
  const rows = getDb()
    .prepare('SELECT o.key, o.patch, o.updated_at AS at, a.name AS by FROM data_overrides o LEFT JOIN admins a ON a.id = o.updated_by')
    .all() as { key: string; patch: string; at: number; by: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.key, { at: r.at, by: r.by, fields: Object.keys(JSON.parse(r.patch)) }]));
}

// ---------- what still stops complaints from reaching officials ----------
export type Readiness = {
  mode: 'off' | 'dry-run' | 'live';
  email: boolean;
  sms: boolean;
  escalation: { role: EscalationRole; title: string; reachable: boolean; verified: boolean }[];
  wardsUnreachable: number[];
  wardsUnverified: number[];
  wardsNoLocation: number[];
  assemblyDraft: boolean;
};

export function readiness(): Readiness {
  const f = getWardFile();
  const env = process.env;
  const sms =
    (env.SMS_PROVIDER === 'twilio' && !!env.TWILIO_ACCOUNT_SID && !!env.TWILIO_AUTH_TOKEN && !!env.TWILIO_FROM) ||
    (env.SMS_PROVIDER === 'fast2sms' && !!env.FAST2SMS_API_KEY);
  const wards = f.wards.filter((w) => !w.placeholder);
  return {
    mode: notifyMode(),
    email: !!env.SMTP_HOST && !!env.MAIL_FROM,
    sms,
    escalation: ESCALATION_ROLES.map((role) => {
      const c = entity(f, `escalation:${role}`) as { title: string; email: string | null; phone: string | null; verified: boolean };
      return { role, title: c.title, reachable: !!(normEmail(c.email) ?? normPhone(c.phone)), verified: !!c.verified };
    }),
    wardsUnreachable: wards.filter((w) => !normEmail(w.councillorEmail) && !councillorMobile(w.councillorPhone)).map((w) => w.wardNumber),
    wardsUnverified: wards.filter((w) => !w.verified).map((w) => w.wardNumber),
    wardsNoLocation: wards.filter((w) => w.lat == null || w.lng == null).map((w) => w.wardNumber),
    assemblyDraft: !(f.representatives?.assemblyMappingVerified ?? true),
  };
}

/** Escalation contacts with defaults filled in, for the editor (the file may not list all three). */
export function escalationContacts() {
  const f = getWardFile();
  return ESCALATION_ROLES.map((role) => ({ role, ...(entity(f, `escalation:${role}`) as { title: string; name: string | null; email: string | null; phone: string | null; verified: boolean }) }));
}
