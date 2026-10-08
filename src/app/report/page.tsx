import type { Metadata } from 'next';
import ReportFlow from '@/components/ReportFlow';
import { getWards } from '@/lib/wards';

export const metadata: Metadata = { title: 'Report a garbage spot' };

export default function ReportPage() {
  const wards = getWards().map((w) => ({ n: w.wardNumber, name: w.name, zone: w.zone }));
  return <ReportFlow wards={wards} />;
}
