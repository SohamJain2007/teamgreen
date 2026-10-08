import { json, fail } from '@/lib/api';
import { REOPEN_THRESHOLD, VERIFY_RADIUS_M } from '@/lib/constants';
import { nearTo } from '@/lib/geo';
import { addStillDirty, getReport } from '@/lib/reports';
import { clientId, rateLimit } from '@/lib/request';

/** Disputes a "cleared" report from the spot. REOPEN_THRESHOLD different people reopen it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const client = clientId(req);
  if (!rateLimit(`vote:${client}`, 40, 60 * 60 * 1000)) return fail('rate', 429);
  const r = getReport(id);
  if (!r || r.hidden) return fail('not_found', 404);
  if (r.status !== 'cleared') return fail('not_cleared', 409);
  const body = await req.json().catch(() => ({}));
  if (!nearTo(r, body.lat, body.lng, VERIFY_RADIUS_M)) return fail('too_far', 403);
  const res = addStillDirty(id, client, REOPEN_THRESHOLD);
  return json(res ? { ...res, already: false } : { already: true });
}
