import { cookies } from 'next/headers';
import { SESSION_TTL_MS, createSession, deleteSession, sessionAdmin, type Admin } from './admins';

const COOKIE = 'sr_admin';

/** The logged-in back-office account, or null. */
export async function currentAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? sessionAdmin(token) : null;
}

/** Logged in and allowed to work on reports (an owner-set password must be replaced first). */
export async function requireAdmin(): Promise<Admin | null> {
  const a = await currentAdmin();
  return a && !a.mustChange ? a : null;
}

export async function requireOwner(): Promise<Admin | null> {
  const a = await requireAdmin();
  return a?.role === 'owner' ? a : null;
}

export async function startSession(adminId: number): Promise<void> {
  (await cookies()).set(COOKIE, createSession(adminId), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(token);
  jar.delete(COOKIE);
}
