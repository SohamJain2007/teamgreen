import { json, fail } from '@/lib/api';
import { addVote, getReport } from '@/lib/reports';
import { clientId, rateLimit } from '@/lib/request';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const client = clientId(req);
  if (!rateLimit(`vote:${client}`, 40, 60 * 60 * 1000)) return fail('rate', 429);
  const r = getReport(id);
  if (!r || r.hidden) return fail('not_found', 404);
  const count = addVote(id, 'up', client);
  return json({ upvotes: count ?? r.upvotes, already: count === null });
}
