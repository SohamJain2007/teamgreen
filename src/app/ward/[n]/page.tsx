import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/lang-server';
import { computeStats, listPublic } from '@/lib/reports';
import { getWard } from '@/lib/wards';
import { daysBetween, fmtNum } from '@/lib/format';
import { ReportCard, Stat } from '@/components/ui';
import Officials from '@/components/Officials';
import MapView from '@/components/MapView';
import { STATUSES, type Status } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n } = await params;
  return { title: `Ward ${n}` };
}

export default async function WardPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const ward = getWard(Number(n));
  if (!ward) notFound();
  const { t } = await getT();
  const reports = listPublic().filter((r) => r.ward === ward.wardNumber);
  const s = computeStats(reports);
  const statusLabels = Object.fromEntries(STATUSES.map((x) => [x, t(`status.${x}`)])) as Record<Status, string>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl">{t('ward.title', { n: ward.wardNumber })}{ward.name ? ` · ${ward.name}` : ''}</h1>
        {ward.area && <p className="mt-1 max-w-2xl">{ward.area}</p>}
        {ward.zone && <p className="text-muted">{t(`zone.${ward.zone}`)}</p>}
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t('ward.open')} value={s.open} />
        <Stat label={t('ward.cleared')} value={s.cleared} />
        <Stat label={t('ward.avgDays')} value={fmtNum(s.avgDaysToClear)} />
        <Stat label={t('ward.oldest')} value={s.oldestOpen ? t('ward.oldestDays', { n: daysBetween(s.oldestOpen.createdAt, Date.now()) }) : '—'} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Officials ward={ward} />
        </div>
        <div className="space-y-2">
          {reports.length > 0 && (
            <MapView
              points={reports.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, status: r.status, thumb: r.thumb, label: r.category ? t(`cat.${r.category}`) : t('r.title'), sub: '' }))}
              statusLabels={statusLabels}
              openLabel={t('tracker.open')}
              className="h-56"
            />
          )}
          <Link href={`/map?ward=${ward.wardNumber}`} className="text-sm font-semibold text-jharna-dark underline">{t('ward.seeMap')}</Link>
        </div>
      </div>

      <section>
        <h2 className="section-title mb-2">{t('ward.reports')}</h2>
        {reports.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t('ward.none')}</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {reports.map((r) => <li key={r.id} className="min-w-0"><ReportCard r={r} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
