import fs from 'node:fs';
import path from 'node:path';
import { haversineM, pointInGeometry } from './geo';
import type { Zone } from './constants';

export type Ward = {
  wardNumber: number;
  zone: Zone | null;
  name: string | null;
  /** Full area description from the 2026 RMC ward member list. */
  area?: string | null;
  councillorName: string | null;
  councillorPhone: string | null;
  /** Optional. When set, complaints go to this address instead of an SMS to councillorPhone. */
  councillorEmail?: string | null;
  lat: number | null;
  lng: number | null;
  centroidSource: string | null;
  source: string;
  verified: boolean;
  placeholder?: boolean;
  /** Slug of the MLA whose assembly seat contains this ward (see representatives.mlas). */
  assembly?: string | null;
};
export type Official = {
  role: string;
  title: string;
  name: string | null;
  phone: string | null;
  source: string;
  verified: boolean;
};
export type Representative = {
  slug: string;
  role: 'MLA' | 'MP' | 'Mayor';
  constituency: string;
  name: string;
  party: string | null;
  phone: string | null;
};
export type OfficerRole = { role: string; note: string; name: string | null };
type WardFile = {
  meta: { readme: string; rmcHelpline: { phone: string; email: string; verified: boolean }; centre: { lat: number; lng: number } };
  rmcOfficials: Official[];
  representatives?: { source: string; mp: Representative; mlas: Representative[]; assemblyMappingVerified: boolean };
  officerChain?: OfficerRole[];
  escalation?: Partial<Record<EscalationRole, EscalationContact>>;
  wards: Ward[];
};
export type EscalationRole = 'commissioner' | 'sdo' | 'dc';
export type EscalationContact = { title: string; name: string | null; email: string | null; phone: string | null; verified: boolean };
type Boundary = { wardNumber: number; geometry: { type: string; coordinates: any } };

const WARDS_PATH = path.join(process.cwd(), 'data', 'wards.json');
const BOUNDS_PATH = path.join(process.cwd(), 'data', 'ward-boundaries.geojson');

// Re-read when the file changes, so editing wards.json needs no rebuild.
const cache: { wards?: { m: number; v: WardFile }; bounds?: { m: number; v: Boundary[] | null } } = {};

function mtime(p: string): number {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return -1;
  }
}

function load(): WardFile {
  const m = mtime(WARDS_PATH);
  if (!cache.wards || cache.wards.m !== m) {
    cache.wards = { m, v: JSON.parse(fs.readFileSync(WARDS_PATH, 'utf8')) as WardFile };
  }
  return cache.wards.v;
}

function loadBoundaries(): Boundary[] | null {
  const m = mtime(BOUNDS_PATH);
  if (cache.bounds && cache.bounds.m === m) return cache.bounds.v;
  let v: Boundary[] | null = null;
  if (m !== -1) {
    try {
      const gj = JSON.parse(fs.readFileSync(BOUNDS_PATH, 'utf8'));
      v = [];
      for (const f of gj.features ?? []) {
        const p = f.properties ?? {};
        const n = Number(p.wardNumber ?? p.ward ?? p.WARD_NO ?? p.Ward_No ?? p.ward_no ?? p.WARD);
        if (Number.isFinite(n) && f.geometry) v.push({ wardNumber: n, geometry: f.geometry });
      }
      if (!v.length) v = null;
    } catch (e) {
      console.error('[wards] could not parse ward-boundaries.geojson:', e);
    }
  }
  cache.bounds = { m, v };
  return v;
}

export function getWardFile() {
  return load();
}
/** Active wards (placeholders such as 54/55 are excluded until filled in). */
export function getWards(): Ward[] {
  return load().wards.filter((w) => !w.placeholder);
}
export function getWard(n: number): Ward | undefined {
  return getWards().find((w) => w.wardNumber === n);
}
export function hasBoundaries(): boolean {
  return loadBoundaries() !== null;
}

export type WardResolution = { ward: number | null; method: 'polygon' | 'centroid' | 'none'; distanceM?: number };

export function resolveWard(lat: number, lng: number): WardResolution {
  const bounds = loadBoundaries();
  if (bounds) {
    const hit = bounds.find((b) => pointInGeometry(lng, lat, b.geometry));
    if (hit && getWard(hit.wardNumber)) return { ward: hit.wardNumber, method: 'polygon' };
  }
  let best: { n: number; d: number } | null = null;
  for (const w of getWards()) {
    if (w.lat == null || w.lng == null) continue;
    const d = haversineM(lat, lng, w.lat, w.lng);
    if (!best || d < best.d) best = { n: w.wardNumber, d };
  }
  return best ? { ward: best.n, method: 'centroid', distanceM: Math.round(best.d) } : { ward: null, method: 'none' };
}

// ---------- elected representatives above the ward ----------
/** Mayor (from rmcOfficials) as a representative who answers for every ward. */
function mayorRep(): Representative | undefined {
  const m = load().rmcOfficials.find((o) => o.role === 'mayor');
  return m?.name ? { slug: 'mayor', role: 'Mayor', constituency: 'Ranchi Municipal Corporation', name: m.name, party: null, phone: m.phone } : undefined;
}
export function getMayor(): Representative | undefined {
  return mayorRep();
}
export function getRepresentatives(): Representative[] {
  const r = load().representatives;
  const mayor = mayorRep();
  return [...(r ? [...r.mlas, r.mp] : []), ...(mayor ? [mayor] : [])];
}
export function getRep(slug: string): Representative | undefined {
  return getRepresentatives().find((r) => r.slug === slug);
}
export function getMp(): Representative | undefined {
  return load().representatives?.mp;
}
export function mlaForWard(w: Ward | undefined): Representative | undefined {
  return w?.assembly ? load().representatives?.mlas.find((m) => m.slug === w.assembly) : undefined;
}
/** Wards a representative answers for: the MP covers every ward, an MLA the wards in their assembly seat. */
export function wardsOfRep(rep: Representative): Ward[] {
  return rep.role === 'MLA' ? getWards().filter((w) => w.assembly === rep.slug) : getWards();
}
/** False while the ward-to-assembly-seat mapping is still a draft. */
export function assemblyMappingVerified(): boolean {
  return load().representatives?.assemblyMappingVerified ?? false;
}
/** Senior official for an escalation step (data/wards.json "escalation"), if configured. */
export function getEscalationContact(role: EscalationRole): EscalationContact | undefined {
  return load().escalation?.[role];
}

export function getOfficerChain(): OfficerRole[] {
  return load().officerChain ?? [];
}
