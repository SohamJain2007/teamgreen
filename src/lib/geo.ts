import { MAX_DISTANCE_FROM_CENTRE_M, RANCHI_CENTRE } from './constants';

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Ring = number[][];

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** GeoJSON Polygon coordinates: first ring = outer, rest = holes. */
function inPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(lng, lat, rings[i])) return false;
  return true;
}

export function pointInGeometry(lng: number, lat: number, geom: { type: string; coordinates: any }): boolean {
  if (geom.type === 'Polygon') return inPolygon(lng, lat, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((p: Ring[]) => inPolygon(lng, lat, p));
  return false;
}

/** Parses lat/lng from a request body and checks they are within `radiusM` of the target. */
/** Metres from target to (lat, lng), or null if the coordinates are missing/invalid. */
export function distanceTo(target: { lat: number; lng: number }, lat: unknown, lng: unknown): number | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return haversineM(la, ln, target.lat, target.lng);
}


/** Metres from the centre of Ranchi. */
export const distanceFromRanchiM = (lat: number, lng: number) => haversineM(lat, lng, RANCHI_CENTRE.lat, RANCHI_CENTRE.lng);

/**
 * Whether a phone's reported position is in Ranchi. A coarse fix (e.g. wifi-based on a laptop) gets the benefit of its
 * accuracy radius, capped at 5 km, so someone at the edge of the city is not turned away by a blurry reading.
 */
export function inRanchi(lat: number, lng: number, accuracyM?: number | null): boolean {
  const slack = Math.min(Math.max(Number(accuracyM) || 0, 0), 5000);
  return distanceFromRanchiM(lat, lng) - slack <= MAX_DISTANCE_FROM_CENTRE_M;
}
