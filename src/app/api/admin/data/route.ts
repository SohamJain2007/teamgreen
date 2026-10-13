import { json, fail } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { resetEdit, saveEdit } from '@/lib/ward-edits';

export const runtime = 'nodejs';

/** Any admin can correct ward and official data; every change is in the activity log with its old and new value. */
export async function POST(req: Request) {
  const me = await requireAdmin();
  if (!me) return fail('unauthorized', 401);
  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? '');
  if (body.action === 'reset') return json({ ok: true, reset: resetEdit(key, me.id) });
  if (body.action !== 'save' || typeof body.values !== 'object' || !body.values) return fail('bad_action');
  const r = saveEdit(key, body.values, me);
  return r.ok ? json(r) : json({ error: r.error, field: r.field }, r.error === 'not_found' ? 404 : 400);
}
