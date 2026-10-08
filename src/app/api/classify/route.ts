import { json, fail } from '@/lib/api';
import { MAX_UPLOAD_BYTES } from '@/lib/constants';
import { clientId, rateLimit } from '@/lib/request';
import { classifyWaste } from '@/lib/waste';

export const runtime = 'nodejs';

/** POST multipart `photo` -> { label: 'wet' | 'dry' | 'mixed', confidence, probs }. A suggestion only; never blocks a report. */
export async function POST(req: Request) {
  if (!rateLimit(`classify:${clientId(req)}`, 30, 60 * 60 * 1000)) return fail('rate', 429);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('bad_form');
  }
  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) return fail('photo');
  if (photo.size > MAX_UPLOAD_BYTES) return fail('photo_too_large', 413);
  try {
    return json(await classifyWaste(Buffer.from(await photo.arrayBuffer())));
  } catch (e) {
    console.error('classify failed', e);
    return fail('classify_failed', 500);
  }
}
