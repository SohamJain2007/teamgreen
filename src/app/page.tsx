import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/lib/lang-server';
import { computeStats, listPublic } from '@/lib/reports';
import { getWard, getWardFile } from '@/lib/wards';
import { fmtNum } from '@/lib/format';
import { ReportCard, Stat } from '@/components/ui';
import { SalLeaf } from '@/components/Ranchi';
import { GALLERY, PHOTOS, PLEDGE_SLIDES, type Photo } from '@/lib/photos';
import PhotoSlider from '@/components/PhotoSlider';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { t } = await getT();
  const reports = listPublic();
  const s = computeStats(reports);
  const hasDemo = reports.some((r) => r.isDemo);
  const helpline = getWardFile().meta.rmcHelpline.phone;

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

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="section-title">{t('home.recent')}</h2>
          <Link href="/map" className="text-sm font-semibold text-jharna-dark underline">{t('home.viewMap')}</Link>
        </div>
        {reports.length === 0 && (
          <div className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg">{t('home.empty.t')}</p>
              <p className="text-sm text-muted">{t('home.empty.d')}</p>
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
