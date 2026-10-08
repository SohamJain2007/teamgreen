import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/lang-server';
import { isAdmin } from '@/lib/auth';
import { getReport } from '@/lib/reports';
import { getWard, getWardFile } from '@/lib/wards';
import { daysBetween, fmtDate, fmtAgo, photoUrl } from '@/lib/format';
import { DemoBadge, StatusBadge } from '@/components/ui';
import Officials from '@/components/Officials';
import ReportActions from '@/components/ReportActions';
import MapView from '@/components/MapView';
import { STATUSES, type Status } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = getReport(id);
  if (!r || r.hidden) return { title: 'Report not found' };
  const title = `Garbage spot${r.ward ? `, Ward ${r.ward}` : ''}, Ranchi: ${r.status}`;
  return { title, openGraph: { title, images: [photoUrl(r.photo)] }, twitter: { card: 'summary_large_image' } };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const r = getReport(id);
  const admin = await isAdmin();
  if (!r || (r.hidden && !admin)) notFound();
  const { t, lang } = await getT();
  const ward = r.ward != null ? getWard(r.ward) : undefined;
  const now = Date.now();

  const reached: Record<Status, number | null> = { reported: r.createdAt, acknowledged: r.acknowledgedAt, cleared: r.clearedAt };
  const statusLabels = Object.fromEntries(STATUSES.map((s) => [s, t(`status.${s}`)])) as Record<Status, string>;
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  const helpline = getWardFile().meta.rmcHelpline.phone;

  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <Link href="/map" className="text-sm font-semibold text-jharna-dark underline">← {t('nav.map')}</Link>

      {sp.new && <p className="rounded-2xl bg-sal-soft p-3 font-semibold text-sal-dark" role="status">{t('r.new')}</p>}
      {sp.voted && <p className="rounded-2xl bg-sal-soft p-3 font-semibold text-sal-dark" role="status">{t('r.upped')}</p>}
      {r.hidden && <p className="rounded-2xl bg-palash-soft p-3 font-semibold text-palash-dark">{t('r.hiddenNote')}</p>}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={r.status} />
          {r.isDemo && <DemoBadge />}
          <span className="font-mono text-xs text-muted">#{r.id}</span>
        </div>
        <h1 className="text-3xl">{r.category ? t(`cat.${r.category}`) : t('r.title')}{ward ? `, ${t('ward.title', { n: ward.wardNumber })}` : ''}</h1>
        <p className="text-muted" suppressHydrationWarning>
          {t('r.reportedOn', { when: fmtDate(r.createdAt, lang) })} ({fmtAgo(r.createdAt, lang, now)})
        </p>
        <p className="font-semibold">
          {r.status === 'cleared' && r.clearedAt
            ? t('r.clearedIn', { n: daysBetween(r.createdAt, r.clearedAt) })
            : t('r.daysOpen', { n: daysBetween(r.createdAt, now) })}
        </p>
        {r.note && <p className="rounded-xl border-l-4 border-palash bg-white p-3">{r.note}</p>}
      </header>

      {r.status === 'cleared' && r.afterPhoto ? (
        <div className="grid grid-cols-2 gap-2">
          {[{ k: r.photo, l: t('r.before') }, { k: r.afterPhoto, l: t('r.after') }].map((p) => (
            <figure key={p.k} className="relative overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.k)} alt={p.l} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="absolute left-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-white">{p.l}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(r.photo)} alt="" className="max-h-[28rem] w-full rounded-2xl border border-line object-cover" />
          {r.status === 'cleared' && <p className="mt-1 text-sm text-muted">{t('r.noAfter')}</p>}
        </div>
      )}

      <section aria-labelledby="tl">
        <h2 id="tl" className="section-title mb-2">{t('r.timeline')}</h2>
        <ol className="card space-y-0 p-4">
          {STATUSES.map((s, i) => {
            const at = reached[s];
            const done = at != null;
            return (
              <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
                {i < STATUSES.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 ${reached[STATUSES[i + 1]] ? 'bg-ink' : 'bg-line'}`} />}
                <span className={`z-[1] mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${done ? (s === 'reported' ? 'bg-palash' : s === 'acknowledged' ? 'bg-haldi' : 'bg-sal') : 'bg-line text-muted'}`}>
                  {done ? '✓' : ''}
                </span>
                <div>
                  <p className={`font-semibold ${done ? '' : 'text-muted'}`}>{statusLabels[s]}</p>
                  <p className="text-sm text-muted">{done ? fmtDate(at!, lang) : t('r.pending')}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <ReportActions id={r.id} upvotes={r.upvotes} />

      <section aria-labelledby="loc">
        <h2 id="loc" className="section-title mb-2">{t('r.location')}</h2>
        <MapView
          points={[{ id: r.id, lat: r.lat, lng: r.lng, status: r.status, thumb: r.thumb, label: r.category ? t(`cat.${r.category}`) : t('r.title'), sub: '' }]}
          statusLabels={statusLabels}
          openLabel={t('tracker.open')}
          highlightId={r.id}
          className="h-56"
        />
        <p className="mt-2 text-sm text-muted">
          {r.lat.toFixed(5)}, {r.lng.toFixed(5)} · {t(`r.locSource.${r.locSource}`)}
          {r.accuracy ? ` ±${r.accuracy} m` : ''} ·{' '}
          <a href={gmaps} className="font-semibold text-jharna-dark underline" target="_blank" rel="noopener noreferrer">{t('r.openMap')}</a>
        </p>
        {ward && (
          <p className="mt-1 text-sm">
            <Link href={`/ward/${ward.wardNumber}`} className="font-semibold text-jharna-dark underline">
              {t('ward.title', { n: ward.wardNumber })}{ward.name ? ` · ${ward.name}` : ''}
            </Link>
            {ward.zone && <> · {t(`zone.${ward.zone}`)}</>} <span className="text-muted">({r.wardAuto ? t('r.wardAutoNote') : t('r.wardChosen')})</span>
          </p>
        )}
      </section>

      <section aria-labelledby="off">
        <h2 id="off" className="section-title mb-2">{t('r.officials')}</h2>
        <Officials ward={ward} />
        <p className="mt-2 text-xs text-muted">{t('alsoRmc')}: <a className="font-semibold underline" href={`tel:${helpline}`}>{helpline}</a></p>
      </section>
    </article>
  );
}
