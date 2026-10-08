import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SafaiRanchi',
    short_name: 'SafaiRanchi',
    description: 'Report garbage black spots in Ranchi in 30 seconds and track them until they are cleared.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F9F6',
    theme_color: '#1A7A50',
    lang: 'en-IN',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Report a spot', url: '/report', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }],
  };
}
