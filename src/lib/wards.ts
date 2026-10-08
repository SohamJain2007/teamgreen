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
  lat: number | null;
  lng: number | null;
  centroidSource: string | null;
  source: string;
  verified: boolean;
  placeholder?: boolean;
};
export type Official = {
  role: string;
  title: string;
  name: string | null;
  phone: string | null;
  source: string;
  verified: boolean;
};
type WardFile = {
  meta: { readme: string; rmcHelpline: { phone: string; email: string; verified: boolean }; centre: { lat: number; lng: number } };
  rmcOfficials: Official[];
  wards: Ward[];
};
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
