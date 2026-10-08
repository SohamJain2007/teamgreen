import { json, fail } from '@/lib/api';
import { VERIFY_CONFIRMATIONS, VERIFY_RADIUS_M } from '@/lib/constants';
import { nearTo } from '@/lib/geo';
import { enqueueForReport } from '@/lib/notify';
import { addEvent, addVote, getReport, maybeVerify } from '@/lib/reports';
import { clientId, rateLimit } from '@/lib/request';

/** "I see this too": a confirmation from someone standing near the spot. Enough of them verify the report. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const client = clientId(req);
  if (!rateLimit(`vote:${client}`, 40, 60 * 60 * 1000)) return fail('rate', 429);
  const r = getReport(id);
  if (!r || r.hidden) return fail('not_found', 404);
  const body = await req.json().catch(() => ({}));
  if (!nearTo(r, body.lat, body.lng, VERIFY_RADIUS_M)) return fail('too_far', 403);
  const count = addVote(id, 'up', client);
  let verified = false;
  if (count !== null) {
    addEvent(id, 'confirmed');
    verified = maybeVerify(id, VERIFY_CONFIRMATIONS);
    if (verified) enqueueForReport(id);
  }
  return json({ upvotes: count ?? r.upvotes, already: count === null, verified: verified || r.verifiedAt != null });
}
