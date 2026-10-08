import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'sr_admin';
const TTL_MS = 12 * 60 * 60 * 1000;

const MIN_PASSWORD_LENGTH = 12;

/** Admin is enabled only when ADMIN_PASSWORD is set to a password of at least 12 characters. There is no default. */
export function adminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length >= MIN_PASSWORD_LENGTH ? pw : null;
}

const sign = (payload: string, pw: string) =>
  crypto.createHmac('sha256', crypto.createHash('sha256').update('sr:' + pw).digest()).update(payload).digest('hex');

export function checkPassword(input: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

export function makeSessionValue(): string {
  const pw = adminPassword()!;
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp, pw)}`;
}

export async function isAdmin(): Promise<boolean> {
  const pw = adminPassword();
  if (!pw) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp, pw);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export const ADMIN_COOKIE = COOKIE;
export const ADMIN_TTL_S = TTL_MS / 1000;
