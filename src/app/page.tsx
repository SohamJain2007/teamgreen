import Link from 'next/link';
import { getT } from '@/lib/lang-server';
import { computeStats, listPublic } from '@/lib/reports';
import { getWard, getWardFile } from '@/lib/wards';
import { fmtNum } from '@/lib/format';
import { ReportCard, Stat } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { t } = await getT();
  const reports = listPublic();
  const s = computeStats(reports);
  const hasDemo = reports.some((r) => r.isDemo);
  const helpline = getWardFile().meta.rmcHelpline.phone;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-laterite px-5 py-8 text-white md:px-10 md:py-12">
        <h1 className="max-w-2xl text-4xl leading-tight md:text-5xl">{t('home.title')}</h1>
        <p className="mt-3 max-w-xl text-lg text-white/90">{t('home.sub')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/report" className="btn bg-white text-laterite-dark hover:bg-paper !text-lg">{t('home.cta')}</Link>
          <Link href="/map" className="btn border border-white/60 text-white hover:bg-white/10">{t('home.viewMap')}</Link>
        </div>
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
              <span className="font-display text-4xl leading-none text-laterite">{n}</span>
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
          <Link href="/map" className="text-sm font-semibold text-laterite-dark underline">{t('home.viewMap')}</Link>
        </div>
        <ul className="grid gap-2 md:grid-cols-2">
          {reports.slice(0, 6).map((r) => (
            <li key={r.id}><ReportCard r={r} wardName={r.ward != null ? getWard(r.ward)?.name : null} /></li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted">{t('alsoRmc')}: <a href={`tel:${helpline}`} className="font-semibold underline">{helpline}</a></p>
    </div>
  );
}
