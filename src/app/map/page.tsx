import type { Metadata } from 'next';
import Tracker from '@/components/Tracker';
import { listPublic } from '@/lib/reports';
import { getWards } from '@/lib/wards';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Public tracker' };

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const wards = getWards().map((w) => ({ n: w.wardNumber, name: w.name, zone: w.zone }));
  return <Tracker reports={listPublic()} wards={wards} initial={{ ward: sp.ward ?? '', status: sp.status ?? '' }} />;
}
