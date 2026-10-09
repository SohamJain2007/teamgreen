import crypto from 'node:crypto';
import { getDb } from './db';

const SALT = process.env.IP_HASH_SALT || 'safairanchi-dev-salt';

// Proxies append the address they saw to X-Forwarded-For, so the trustworthy entry is counted from the right; anything
// further left was sent by the client and can be faked. TRUSTED_PROXY_HOPS = number of proxies in front of the app (Railway: 1).
const HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

export function clientId(req: Request): string {
  const chain = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const fwd = chain.length ? chain[Math.max(0, chain.length - HOPS)] : null;
  const ip = fwd || req.headers.get('x-real-ip') || 'local';
  return crypto.createHash('sha256').update(SALT + ip).digest('hex').slice(0, 32);
}

/** Fixed-window limiter backed by SQLite. Returns true if the action is allowed. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const db = getDb();
  const now = Date.now();
  const row = db.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?').get(key) as
    | { count: number; reset_at: number }
    | undefined;
  if (!row || row.reset_at <= now) {
    db.prepare('INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)').run(key, now + windowMs);
    return true;
  }
  if (row.count >= max) return false;
  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return true;
}
