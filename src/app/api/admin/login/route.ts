import { json, fail } from '@/lib/api';
import { adminEnabled, audit, checkLogin, normUsername } from '@/lib/admins';
import { startSession } from '@/lib/auth';
import { clientId, isLimited, rateLimit } from '@/lib/request';

const WINDOW_MS = 15 * 60 * 1000;

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!adminEnabled()) return fail('disabled', 503);
  const body = await req.json().catch(() => ({}));
  const username = normUsername(String(body.username ?? '')).slice(0, 64);
  // Only failed attempts count, per network (the whole office shares one) and per account (guessing from many networks).
  const keys = [`login:${clientId(req)}`, `login-user:${username}`];
  if (isLimited(keys[0], 20) || isLimited(keys[1], 10)) return fail('rate', 429);
  const admin = checkLogin(username, String(body.password ?? ''));
  if (!admin) {
    rateLimit(keys[0], 20, WINDOW_MS);
    rateLimit(keys[1], 10, WINDOW_MS);
    return fail('wrong', 401);
  }
  await startSession(admin.id);
  audit(admin.id, 'login');
  return json({ ok: true, mustChange: admin.mustChange });
}
