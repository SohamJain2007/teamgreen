'use client';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('./LocationPickerImpl'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-line" />,
});
export default LocationPicker;
