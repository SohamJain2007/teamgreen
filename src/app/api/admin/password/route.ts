import { json, fail } from '@/lib/api';
import { audit, checkOwnPassword, setPassword } from '@/lib/admins';
import { currentAdmin, startSession } from '@/lib/auth';
import { clientId, rateLimit } from '@/lib/request';

export const runtime = 'nodejs';

/** Change your own password (also how someone replaces a password an owner set for them). Signs out every other session. */
export async function POST(req: Request) {
  const me = await currentAdmin();
  if (!me) return fail('unauthorized', 401);
  if (!rateLimit(`pw:${me.id}:${clientId(req)}`, 10, 15 * 60 * 1000)) return fail('rate', 429);
  const body = await req.json().catch(() => ({}));
  if (!checkOwnPassword(me.id, String(body.current ?? ''))) return fail('wrong', 401);
  const next = String(body.password ?? '');
  if (next === String(body.current)) return fail('same_as_old');
  const err = setPassword(me.id, next, false);
  if (err) return fail(err);
  await startSession(me.id);
  audit(me.id, 'password_changed');
  return json({ ok: true });
}
