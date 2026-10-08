import { getStorage, isSafeKey } from '@/lib/storage';

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!isSafeKey(key)) return new Response('Not found', { status: 404 });
  const data = await getStorage().get(key);
  if (!data) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Keys are unique per upload, so they can be cached forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
