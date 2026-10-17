import type { Metadata } from 'next';
import ReportFlow from '@/components/ReportFlow';
import { getWardFile, getWards } from '@/lib/wards';
import { REPORT_TYPES, type ReportType } from '@/lib/constants';

export const metadata: Metadata = { title: 'Report a problem' };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const type = (REPORT_TYPES as readonly string[]).includes(sp.type ?? '') ? (sp.type as ReportType) : null;
  const wards = getWards().map((w) => ({ n: w.wardNumber, name: w.name, zone: w.zone }));
  const forestPhone = getWardFile().meta.forestHelpline?.phone ?? null;
  // key: a link to another type (e.g. from the home page) starts the form afresh.
  return <ReportFlow key={type ?? 'pick'} wards={wards} initialType={type} forestPhone={forestPhone} />;
}
