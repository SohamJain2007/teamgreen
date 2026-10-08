import { json, fail } from '@/lib/api';
import { addVote, getReport } from '@/lib/reports';
import { clientId, rateLimit } from '@/lib/request';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const client = clientId(req);
  if (!rateLimit(`spam:${client}`, 20, 60 * 60 * 1000)) return fail('rate', 429);
  const r = getReport(id);
  if (!r) return fail('not_found', 404);
  addVote(id, 'spam', client);
  return json({ ok: true });
}
