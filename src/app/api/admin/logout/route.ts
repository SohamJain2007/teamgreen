import { json } from '@/lib/api';
import { endSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  await endSession();
  return json({ ok: true });
}
