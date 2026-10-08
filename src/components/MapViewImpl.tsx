'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RANCHI_CENTRE } from '@/lib/constants';
import { photoUrl } from '@/lib/format';
import type { Status } from '@/lib/constants';

export type MapPoint = { id: string; lat: number; lng: number; status: Status; thumb: string; label: string; sub: string };
type Props = {
  points: MapPoint[];
  statusLabels: Record<Status, string>;
  openLabel: string;
  fit?: boolean;
  zoom?: number;
  className?: string;
  highlightId?: string;
};

const HEX: Record<Status, string> = { reported: '#DD5A26', acknowledged: '#C77D0A', cleared: '#1A7A50' };
const GLYPH: Record<Status, string> = { reported: '!', acknowledged: '…', cleared: '✓' };

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function icon(status: Status, big: boolean) {
  const s = big ? 36 : 28;
  return L.divIcon({
    className: 'sr-pin',
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
    popupAnchor: [0, -s + 4],
    html: `<div style="width:${s}px;height:${s}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${HEX[status]};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font:700 ${big ? 16 : 13}px/1 sans-serif">${GLYPH[status]}</span></div>`,
  });
}

function popupEl(p: MapPoint, statusLabel: string, openLabel: string) {
  const root = document.createElement('div');
  const img = document.createElement('img');
  img.src = photoUrl(p.thumb);
  img.alt = '';
  img.style.cssText = 'width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:6px';
  const st = document.createElement('div');
  st.textContent = statusLabel;
  st.style.cssText = `font-weight:700;color:${HEX[p.status]};font-size:13px`;
  const lb = document.createElement('div');
  lb.textContent = p.label;
  lb.style.cssText = 'font-weight:600';
  const sub = document.createElement('div');
  sub.textContent = p.sub;
  sub.style.cssText = 'font-size:12px;color:#6B6259;margin-bottom:6px';
  const a = document.createElement('a');
  a.href = `/r/${p.id}`;
  a.textContent = openLabel + ' →';
  a.style.cssText = 'font-weight:700;color:#075E6B';
  root.append(img, st, lb, sub, a);
  return root;
}

export default function MapViewImpl({ points, statusLabels, openLabel, fit = true, zoom = 12, className = 'h-[60vh]', highlightId }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([RANCHI_CENTRE.lat, RANCHI_CENTRE.lng], zoom);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, [zoom]);

  useEffect(() => {
    const m = map.current;
    const lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    for (const p of points) {
      L.marker([p.lat, p.lng], { icon: icon(p.status, p.id === highlightId), zIndexOffset: p.id === highlightId ? 1000 : 0, title: p.label })
        .bindPopup(() => popupEl(p, statusLabels[p.status], openLabel))
        .addTo(lg);
    }
    if (fit && points.length) {
      if (points.length === 1) m.setView([points[0].lat, points[0].lng], 16);
      else m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.15), { maxZoom: 16 });
    }
    setTimeout(() => m.invalidateSize(), 50);
  }, [points, statusLabels, openLabel, fit, highlightId]);

  return <div ref={el} className={`z-0 w-full overflow-hidden rounded-2xl border border-line ${className}`} role="application" aria-label="Map" />;
}
