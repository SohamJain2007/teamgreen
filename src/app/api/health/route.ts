import { json } from '@/lib/api';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness check for the host (Railway): the app is up and the database answers. */
export function GET() {
  try {
    getDb().prepare('SELECT 1').get();
    return json({ ok: true });
  } catch (e) {
    console.error('[health]', e);
    return json({ ok: false }, 503);
  }
}
