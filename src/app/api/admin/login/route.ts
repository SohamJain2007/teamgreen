import { cookies } from 'next/headers';
import { json, fail } from '@/lib/api';
import { ADMIN_COOKIE, ADMIN_TTL_S, adminPassword, checkPassword, makeSessionValue } from '@/lib/auth';
import { clientId, rateLimit } from '@/lib/request';

export async function POST(req: Request) {
  if (!adminPassword()) return fail('disabled', 503);
  if (!rateLimit(`login:${clientId(req)}`, 10, 15 * 60 * 1000)) return fail('rate', 429);
  const body = await req.json().catch(() => ({}));
  if (!checkPassword(String(body.password ?? ''))) return fail('wrong', 401);
  (await cookies()).set(ADMIN_COOKIE, makeSessionValue(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_TTL_S,
  });
  return json({ ok: true });
}
