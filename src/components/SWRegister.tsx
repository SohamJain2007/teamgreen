'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    // Only in production builds: a service worker fights Next's dev HMR.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
