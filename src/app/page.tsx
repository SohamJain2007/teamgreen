import Link from 'next/link';
import { getT } from '@/lib/lang-server';
import { computeStats, listPublic } from '@/lib/reports';
import { getWard, getWardFile } from '@/lib/wards';
import { fmtNum } from '@/lib/format';
import { ReportCard, Stat } from '@/components/ui';
import { RanchiSkyline, SalLeaf } from '@/components/Ranchi';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { t } = await getT();
  const reports = listPublic();
  const s = computeStats(reports);
  const hasDemo = reports.some((r) => r.isDemo);
  const helpline = getWardFile().meta.rmcHelpline.phone;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-jharna-soft via-sal-soft/60 to-white">
        <div className="relative z-[1] px-5 pb-28 pt-8 sm:pb-40 md:px-10 md:pb-64 md:pt-12">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sal-dark ring-1 ring-sal/15">
            <SalLeaf size={14} className="text-sal" />
            {t('home.kicker')}
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl leading-tight md:text-5xl">{t('home.title')}</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">{t('home.sub')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/report" className="btn-primary !text-lg">{t('home.cta')}</Link>
            <Link href="/map" className="btn-ghost">{t('home.viewMap')}</Link>
          </div>
        </div>
        <RanchiSkyline className="absolute inset-x-0 bottom-0 h-auto w-full" />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Stat label={t('home.stat.open')} value={s.open} />
        <Stat label={t('home.stat.cleared')} value={s.cleared} />
        <Stat label={t('home.stat.avgDays')} value={fmtNum(s.avgDaysToClear)} />
      </section>
      {hasDemo && <p className="-mt-5 rounded-xl bg-haldi-soft p-2.5 text-center text-sm font-semibold text-haldi-text">{t('home.demoNote')}</p>}

      <section>
        <h2 className="section-title mb-3">{t('home.how.title')}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="card flex gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sal-soft font-display text-xl text-sal-dark">{n}</span>
              <div>
                <p className="text-lg font-bold">{t(`home.how.${n}.t`)}</p>
                <p className="text-sm text-muted">{t(`home.how.${n}.d`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="section-title">{t('home.recent')}</h2>
          <Link href="/map" className="text-sm font-semibold text-jharna-dark underline">{t('home.viewMap')}</Link>
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {reports.slice(0, 6).map((r) => (
            <li key={r.id} className="min-w-0"><ReportCard r={r} wardName={r.ward != null ? getWard(r.ward)?.name : null} /></li>
          ))}
        </ul>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-jharna-dark px-5 py-7 text-white md:px-10">
        <svg viewBox="0 0 200 120" className="absolute -right-6 bottom-0 h-full w-48 opacity-30 md:w-64" aria-hidden="true">
          <path d="M70 0 C76 40 72 80 64 120 H112 C104 80 100 40 106 0Z" fill="#FFFFFF" />
          <path d="M82 10 v90 M92 6 v104 M100 12 v80" stroke="#BFE6EA" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <h2 className="relative text-2xl">{t('home.pledge.t')}</h2>
        <p className="relative mt-2 max-w-xl text-white/85">{t('home.pledge.d')}</p>
        <Link href="/report" className="btn relative mt-5 bg-white text-jharna-dark hover:bg-jharna-soft">{t('home.cta')}</Link>
      </section>

      <p className="text-sm text-muted">{t('alsoRmc')}: <a href={`tel:${helpline}`} className="font-semibold underline">{helpline}</a></p>
    </div>
  );
}
