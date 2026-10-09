import { json, fail, tooFar } from '@/lib/api';
import { MAX_UPLOAD_BYTES, VERIFY_RADIUS_M } from '@/lib/constants';
import { distanceTo } from '@/lib/geo';
import { processPhoto } from '@/lib/image';
import { getReport, markCleared } from '@/lib/reports';
import { clientId, rateLimit } from '@/lib/request';
import { getStorage } from '@/lib/storage';
import { enqueueCleared } from '@/lib/notify';

export const runtime = 'nodejs';

/** A citizen at the spot posts an "it's clean now" photo. Others can dispute it with "still dirty". */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!rateLimit(`clean:${clientId(req)}`, 6, 60 * 60 * 1000)) return fail('rate', 429);
  const r = getReport(id);
  if (!r || r.hidden) return fail('not_found', 404);
  if (r.status === 'cleared') return fail('already_cleared', 409);
  const form = await req.formData().catch(() => null);
  if (!form) return fail('bad_form');
  const dist = distanceTo(r, form.get('lat'), form.get('lng'));
  if (dist == null || dist > VERIFY_RADIUS_M) return tooFar(dist);
  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) return fail('photo');
  if (photo.size > MAX_UPLOAD_BYTES) return fail('photo_too_large', 413);
  let p;
  try {
    p = await processPhoto(Buffer.from(await photo.arrayBuffer()));
  } catch {
    return fail('photo_invalid');
  }
  const stamp = Date.now().toString(36);
  const st = getStorage();
  const after = { photo: `${id}_a${stamp}.jpg`, thumb: `${id}_a${stamp}_t.jpg` };
  await st.put(after.photo, p.full);
  await st.put(after.thumb, p.thumb);
  markCleared(id, 'citizen', after);
  enqueueCleared(id);
  return json({ ok: true });
}
