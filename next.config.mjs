/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'sharp', 'onnxruntime-node'],
  outputFileTracingIncludes: {
    '/**': ['./data/wards.json', './data/ward-boundaries.geojson', './ml/model/waste.onnx', './ml/model/labels.json'],
  },
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};
export default nextConfig;
