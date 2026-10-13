import { NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { getWardFile } from '@/lib/wards';

export const runtime = 'nodejs';

/** data/wards.json with every admin edit applied: a backup, or a drop-in replacement for the file in the repo. */
export async function GET() {
  if (!(await requireAdmin())) return fail('unauthorized', 401);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(getWardFile(), null, 2) + '\n', {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="wards-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
