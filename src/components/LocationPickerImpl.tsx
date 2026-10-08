'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RANCHI_CENTRE } from '@/lib/constants';
import { TILE_ATTR, TILE_URL } from './MapViewImpl';

type Props = { value: { lat: number; lng: number } | null; onChange: (lat: number, lng: number) => void };

export default function LocationPickerImpl({ value, onChange }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!el.current || map.current) return;
    const start = value ?? RANCHI_CENTRE;
    const m = L.map(el.current).setView([start.lat, start.lng], value ? 17 : 12);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(m);
    const mk = L.marker([start.lat, start.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'sr-pin',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        html: '<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1A7A50;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
      }),
    });
    if (value) mk.addTo(m);
    mk.on('dragend', () => cb.current(mk.getLatLng().lat, mk.getLatLng().lng));
    m.on('click', (e: L.LeafletMouseEvent) => {
      mk.setLatLng(e.latlng).addTo(m);
      cb.current(e.latlng.lat, e.latlng.lng);
    });
    map.current = m;
    marker.current = mk;
    setTimeout(() => m.invalidateSize(), 50);
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external changes (e.g. GPS lock arriving after the map opened).
  useEffect(() => {
    const m = map.current;
    const mk = marker.current;
    if (!m || !mk || !value) return;
    const cur = mk.getLatLng();
    if (!m.hasLayer(mk) || Math.abs(cur.lat - value.lat) > 1e-7 || Math.abs(cur.lng - value.lng) > 1e-7) {
      mk.setLatLng([value.lat, value.lng]).addTo(m);
      m.setView([value.lat, value.lng], Math.max(m.getZoom(), 17));
    }
  }, [value]);

  return <div ref={el} className="z-0 h-64 w-full overflow-hidden rounded-xl border border-line" role="application" aria-label="Pick location" />;
}
