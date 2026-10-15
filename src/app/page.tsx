import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/lib/lang-server';
import { computeStats, listPublic } from '@/lib/reports';
import { getWard, getWardFile } from '@/lib/wards';
import { fmtNum } from '@/lib/format';
import { ReportCard } from '@/components/ui';
import { SalLeaf } from '@/components/Ranchi';
import { GALLERY, PHOTOS, PLEDGE_SLIDES, type Photo } from '@/lib/photos';
import PhotoSlider from '@/components/PhotoSlider';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { t } = await getT();
  const reports = listPublic();
  const s = computeStats(reports);
  const hasDemo = reports.some((r) => r.isDemo);
  const wardFile = getWardFile();
  const helpline = wardFile.meta.rmcHelpline.phone;
  const wardCount = wardFile.wards.length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-ink text-white">
        <Image src={PHOTOS.hundru.src} alt={t(PHOTOS.hundru.place)} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/60 to-ink/20 md:bg-gradient-to-r md:from-ink/85 md:via-ink/50 md:to-transparent" />
        <div className="relative z-[1] px-5 pb-12 pt-28 md:px-10 md:py-20">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur">
            <SalLeaf size={14} className="text-sal-soft" />
            {t('home.kicker')}
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl leading-tight md:text-5xl">{t('home.title')}</h1>
          <p className="mt-3 max-w-xl text-lg text-white/85">{t('home.sub')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/report" className="btn-primary !text-lg">{t('home.cta')}</Link>
            <Link href="/map" className="btn border border-white/50 text-white backdrop-blur hover:bg-white/10">{t('home.viewMap')}</Link>
          </div>
          <p className="mt-6 inline-flex items-center gap-2.5 rounded-2xl bg-white py-1.5 pl-3 pr-2 text-xs font-semibold text-ink shadow-lg shadow-black/20">
            {t('initiative.by')}
            <Image src="/team-green.png" alt="Team G.R.E.E.N." width={294} height={160} className="h-9 w-auto md:h-11" />
          </p>
        </div>
        <Credit photo={PHOTOS.hundru} label={`${t(PHOTOS.hundru.place)} · ${t('photo.by', { name: PHOTOS.hundru.artist, license: PHOTOS.hundru.license })}`} />
      </section>

      {s.total ? (
        <section className="grid grid-cols-3 gap-2 md:gap-3">
          <StatLink href="/map" tone="palash" value={s.open} label={t('home.stat.open')} />
          <StatLink href="/map?status=cleared" tone="sal" value={s.cleared} label={t('home.stat.cleared')} />
          <StatLink href="/leaderboard?sort=days" tone="jharna" value={fmtNum(s.avgDaysToClear)} label={t('home.stat.avgDays')} />
        </section>
      ) : (
        // A brand-new site would show "0 · 0 · —"; say what people get instead until the first report is in.
        <section className="grid grid-cols-3 gap-2 md:gap-3">
          <StatLink href="/leaderboard" tone="sal" value={wardCount} label={t('home.fact.wards')} />
          <StatLink href="/report" tone="jharna" value={t('home.fact.timeV')} label={t('home.fact.time')} />
          <StatLink href="/report" tone="palash" value={t('home.fact.freeV')} label={t('home.fact.free')} />
        </section>
      )}
      {hasDemo && <p className="-mt-5 rounded-xl bg-haldi-soft p-2.5 text-center text-sm font-semibold text-haldi-text">{t('home.demoNote')}</p>}

      <section>
        <h2 className="section-title mb-3">{t('home.how.title')}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={i} className="card relative flex gap-4 p-4 md:flex-col md:gap-3 md:p-5">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${step.tone}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {step.icon.map((d) => <path key={d} d={d} />)}
                </svg>
              </span>
              <div>
                <p className="text-lg font-bold">
                  <span className="mr-1.5 font-display text-sm text-muted">{i + 1}.</span>
                  {t(`home.how.${(i + 1) as 1 | 2 | 3}.t`)}
                </p>
                <p className="text-sm text-muted">{t(`home.how.${(i + 1) as 1 | 2 | 3}.d`)}</p>
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
        {reports.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-sal/30 bg-sal-soft/40 px-5 py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-sal shadow-sm">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {STEPS[0].icon.map((d) => <path key={d} d={d} />)}
              </svg>
            </span>
            <div>
              <p className="font-display text-lg">{t('home.empty.t')}</p>
              <p className="mx-auto max-w-sm text-sm text-muted">{t('home.empty.d')}</p>
            </div>
            <Link href="/report" className="btn-primary">{t('home.cta')}</Link>
          </div>
        )}
        <ul className="grid gap-2 md:grid-cols-2">
          {reports.slice(0, 6).map((r) => (
            <li key={r.id} className="min-w-0"><ReportCard r={r} wardName={r.ward != null ? getWard(r.ward)?.name : null} /></li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="section-title">{t('gallery.title')}</h2>
        <p className="mb-3 mt-1 text-muted">{t('gallery.sub')}</p>
        <ul className="grid auto-rows-[150px] grid-cols-2 gap-2 sm:auto-rows-[190px] md:grid-cols-3 md:gap-3 md:auto-rows-[210px]">
          {GALLERY.map((ph, i) => (
            <li
              key={ph.slug}
              className={`group relative overflow-hidden rounded-2xl bg-line ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === GALLERY.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}
            >
              <Image
                src={ph.src}
                alt={t(ph.place)}
                fill
                sizes={i === 0 ? '(min-width: 768px) 680px, 100vw' : '(min-width: 768px) 340px, 50vw'}
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
              <p className="absolute bottom-2 left-3 right-3 font-display text-sm text-white md:text-base">{t(ph.place)}</p>
              <Credit photo={ph} label={t('photo.by', { name: ph.artist, license: ph.license })} top />
            </li>
          ))}
        </ul>
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-jharna-dark px-5 pb-12 pt-10 text-white md:px-10 md:py-16">
        <PhotoSlider
          slides={PLEDGE_SLIDES.map((ph) => ({
            src: ph.src,
            alt: t(ph.place),
            credit: `${t(ph.place)} · ${t('photo.by', { name: ph.artist, license: ph.license })}`,
            page: ph.page,
          }))}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-jharna-dark/95 via-jharna-dark/70 to-jharna-dark/10" />
        <div className="relative z-[1] max-w-xl">
          <h2 className="text-2xl md:text-3xl">{t('home.pledge.t')}</h2>
          <p className="mt-2 text-white/85">{t('home.pledge.d')}</p>
          <Link href="/report" className="btn mt-5 bg-white text-jharna-dark hover:bg-jharna-soft">{t('home.cta')}</Link>
        </div>
      </section>

      <p className="text-sm text-muted">{t('alsoRmc')}: <a href={`tel:${helpline}`} className="font-semibold underline">{helpline}</a></p>
    </div>
  );
}

const STEPS = [
  // camera
  { tone: 'bg-sal-soft text-sal-dark', icon: ['M3 8.5A2 2 0 015 6.5h2.2L8.8 4h6.4l1.6 2.5H19a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z'] },
  // map pin
  { tone: 'bg-jharna-soft text-jharna-dark', icon: ['M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z', 'M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z'] },
  // eye
  { tone: 'bg-palash-soft text-palash-dark', icon: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 100-6 3 3 0 000 6z'] },
];

const TONE = { sal: 'text-sal-dark', jharna: 'text-jharna-dark', palash: 'text-palash' } as const;

function StatLink({ href, tone, value, label }: { href: string; tone: keyof typeof TONE; value: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card group block px-2 py-3.5 text-center transition hover:-translate-y-0.5 hover:border-sal/40 hover:shadow-md md:py-5">
      <p className={`font-display text-2xl leading-none md:text-4xl ${TONE[tone]}`}>{value}</p>
      <p className="mt-1.5 text-xs font-semibold leading-tight text-muted md:text-sm">{label}</p>
    </Link>
  );
}

/** Small attribution link required by the photos' CC licences. */
function Credit({ photo, label, top = false }: { photo: Photo; label: string; top?: boolean }) {
  return (
    <a
      href={photo.page}
      target="_blank"
      rel="noopener noreferrer"
      className={`absolute right-2 z-[1] max-w-[85%] truncate rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/85 hover:text-white ${top ? 'top-2' : 'bottom-2'}`}
    >
      {label}
    </a>
  );
}
