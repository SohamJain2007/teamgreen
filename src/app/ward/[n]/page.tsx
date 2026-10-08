import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/lang-server';
import { computeStats, listPublic } from '@/lib/reports';
import { assemblyMappingVerified, getMayor, getMp, getOfficerChain, getWard, mlaForWard } from '@/lib/wards';
import { ReportCard } from '@/components/ui';
import { AccountabilityChain, Avatar, StatTiles, SummaryBox, type Contact } from '@/components/Accountability';
import ShareButton from '@/components/ShareButton';
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
  const mla = mlaForWard(ward);
  const mp = getMp();
  const mayor = getMayor();
  const elected: Contact[] = [
    ...(ward.councillorName ? [{ name: ward.councillorName, role: t('role.councillor'), phone: ward.councillorPhone, sub: t('ward.title', { n: ward.wardNumber }) }] : []),
    ...(mla ? [{ name: mla.name, role: t('role.mla'), party: mla.party, phone: mla.phone, href: `/rep/${mla.slug}`, sub: mla.constituency }] : []),
    ...(mp ? [{ name: mp.name, role: t('role.mp'), party: mp.party, phone: mp.phone, href: `/rep/${mp.slug}`, sub: 'Ranchi' }] : []),
    ...(mayor ? [{ name: mayor.name, role: t('role.mayor'), phone: mayor.phone, href: '/rep/mayor', sub: 'RMC' }] : []),
  ];
  const statusLabels = Object.fromEntries(STATUSES.map((x) => [x, t(`status.${x}`)])) as Record<Status, string>;

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        {ward.councillorName && <Avatar name={ward.councillorName} size={60} />}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl">{t('ward.title', { n: ward.wardNumber })}{ward.name ? ` · ${ward.name}` : ''}</h1>
          {ward.councillorName && <p className="font-semibold">{ward.councillorName} <span className="font-normal text-muted">· {t('role.councillor')}</span></p>}
          {ward.zone && <p className="text-sm text-muted">{t(`zone.${ward.zone}`)}</p>}
        </div>
        <ShareButton title={`Ward ${ward.wardNumber}, Ranchi: garbage record`} label={t('r.share')} copiedLabel={t('r.copied')} />
      </header>
      {ward.area && <p className="max-w-2xl text-sm">{ward.area}</p>}

      <StatTiles t={t} s={s} />
      <SummaryBox t={t} s={s} name={ward.councillorName ?? t('ward.title', { n: ward.wardNumber })} wardsWithOpen={1} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="section-title">{t('acc.chain')}</h2>
          <AccountabilityChain
            t={t}
            officers={getOfficerChain()}
            elected={elected}
            waText={`Garbage spots in Ward ${ward.wardNumber}${ward.name ? ` (${ward.name})` : ''}, Ranchi: ${s.open} unresolved. Details: ${process.env.NEXT_PUBLIC_SITE_URL || ''}/ward/${ward.wardNumber}`}
            draftNote={mla && !assemblyMappingVerified() ? t('acc.draftMap') : null}
          />
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
