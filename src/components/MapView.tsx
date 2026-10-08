'use client';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapViewImpl'), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse rounded-2xl bg-line" />,
});
export default MapView;
export type { MapPoint } from './MapViewImpl';
