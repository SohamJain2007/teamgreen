'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    // Only in production builds: a service worker fights Next's dev HMR.
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } else {
      // A worker left over from a prod run on the same origin serves stale /_next/static chunks.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    }
  }, []);
  return null;
}
