import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/lang-server';
import type { Key } from '@/lib/translations';
import { isAdmin } from '@/lib/auth';
import { getReport, listEvents, severity } from '@/lib/reports';
import { complaintText, listNotifications, notifyMode, rmcEmail as getRmcEmail } from '@/lib/notify';
import { assemblyMappingVerified, getMayor, getMp, getOfficerChain, getWard, getWardFile, mlaForWard } from '@/lib/wards';
import { daysBetween, fmtDate, fmtAgo, fmtDuration, photoUrl } from '@/lib/format';
import { DemoBadge, StatusBadge } from '@/components/ui';
import { AccountabilityChain, SEV_DOT, type Contact } from '@/components/Accountability';
import ShareButton from '@/components/ShareButton';
import ReportActions from '@/components/ReportActions';
import MapView from '@/components/MapView';
import { REOPEN_THRESHOLD, STATUSES, VERIFY_CONFIRMATIONS, VERIFY_RADIUS_M, type Status } from '@/lib/constants';

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

  const events = listEvents(r.id);
  // Only deliveries to officials are public; the reporter's own "cleared" notices are private.
  const deliveries = listNotifications(r.id).filter((d) => d.kind !== 'cleared');
  const rmcEmail = getRmcEmail();
  const firstSent = events.find((e) => e.kind === 'notified')?.at ?? null;
  // Public journey of a complaint. "Sent" is the first successful (or test-mode) delivery to officials.
  const steps: { key: string; label: string; at: number | null; color: string; note?: string }[] = [
    { key: 'reported', label: t('status.reported'), at: r.createdAt, color: 'bg-palash' },
    { key: 'verified', label: t('step.verified'), at: r.verifiedAt, color: 'bg-jharna' },
    ...(notifyMode() !== 'off' || deliveries.length ? [{ key: 'sent', label: t('step.sent'), at: firstSent, color: 'bg-jharna' }] : []),
    { key: 'acknowledged', label: t('status.acknowledged'), at: r.acknowledgedAt, color: 'bg-haldi' },
    { key: 'cleared', label: t('status.cleared'), at: r.clearedAt, color: 'bg-sal', note: r.clearedBy === 'citizen' ? t('r.clearedByCitizen') : undefined },
  ];
  const sev = r.status === 'cleared' ? null : severity(r, now);
  const mla = mlaForWard(ward);
  const mp = getMp();
  const mayor = getMayor();
  const elected: Contact[] = [
    ...(ward?.councillorName ? [{ name: ward.councillorName, role: t('role.councillor'), phone: ward.councillorPhone, href: `/ward/${ward.wardNumber}`, sub: t('ward.title', { n: ward.wardNumber }) }] : []),
    ...(mla ? [{ name: mla.name, role: t('role.mla'), party: mla.party, phone: mla.phone, href: `/rep/${mla.slug}`, sub: mla.constituency }] : []),
    ...(mp ? [{ name: mp.name, role: t('role.mp'), party: mp.party, phone: mp.phone, href: `/rep/${mp.slug}`, sub: 'Ranchi' }] : []),
    ...(mayor ? [{ name: mayor.name, role: t('role.mayor'), phone: mayor.phone, href: '/rep/mayor', sub: 'RMC' }] : []),
  ];
  const daysOpen = daysBetween(r.createdAt, r.clearedAt ?? now);
  const summary = [
    t('bar.reported', { d: fmtAgo(r.createdAt, lang, now) }),
    t('bar.seen', { n: r.upvotes }),
    r.status === 'cleared' ? t('r.clearedIn', { n: daysOpen }) : t('bar.unresolved', { n: daysOpen }),
  ].join(' · ');
  const statusLabels = Object.fromEntries(STATUSES.map((s) => [s, t(`status.${s}`)])) as Record<Status, string>;
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  const helpline = getWardFile().meta.rmcHelpline.phone;

  return (
    <article className="mx-auto max-w-2xl space-y-5 pb-32">
      <Link href="/map" className="text-sm font-semibold text-jharna-dark underline">← {t('nav.map')}</Link>

      {sp.new && <p className="rounded-2xl bg-sal-soft p-3 font-semibold text-sal-dark" role="status">{t('r.new')}</p>}
      {sp.voted && <p className="rounded-2xl bg-sal-soft p-3 font-semibold text-sal-dark" role="status">{t('r.upped')}</p>}
      {r.hidden && <p className="rounded-2xl bg-palash-soft p-3 font-semibold text-palash-dark">{t('r.hiddenNote')}</p>}

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="flex flex-1 items-center gap-2 text-sm font-bold uppercase tracking-wide">
            {sev ? (
              <>
                <span className={`h-2.5 w-2.5 rounded-full ${SEV_DOT[sev]}`} aria-hidden="true" />
                {t(`sev.${sev}`)} <span className="text-muted">·</span> <span className="text-palash-dark">{t('sev.unresolved')}</span>
              </>
            ) : (
              <><span className="h-2.5 w-2.5 rounded-full bg-sal" aria-hidden="true" /><span className="text-sal-dark">{t('sev.resolved')}</span></>
            )}
          </p>
          <ShareButton title={`Garbage spot #${r.id}, Ranchi`} label={t('r.share')} copiedLabel={t('r.copied')} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={r.status} />
          {r.verifiedAt && <span className="rounded-full bg-jharna-soft px-2.5 py-1 text-xs font-bold text-jharna-dark">✓ {t('step.verified')}</span>}
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
          {steps.map((st, i) => {
            const done = st.at != null;
            const nextDone = steps[i + 1]?.at != null;
            const prev = steps.slice(0, i).reverse().find((x) => x.at != null)?.at;
            return (
              <li key={st.key} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 ${nextDone ? 'bg-ink' : 'bg-line'}`} />}
                <span className={`z-[1] mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${done ? st.color : 'bg-line text-muted'}`}>
                  {done ? '✓' : ''}
                </span>
                <div>
                  <p className={`font-semibold ${done ? '' : 'text-muted'}`}>{st.label}</p>
                  <p className="text-sm text-muted" suppressHydrationWarning>
                    {done ? fmtDate(st.at!, lang) : st.key === 'verified' ? t('r.confirmProgress', { n: Math.min(Math.max(0, r.upvotes - 1), VERIFY_CONFIRMATIONS), m: VERIFY_CONFIRMATIONS }) : t('r.pending')}
                    {done && prev != null && i > 0 ? ` · ${t('r.took', { n: fmtDuration(st.at! - prev, lang) })}` : ''}
                  </p>
                  {st.note && <p className="text-sm font-semibold text-sal-dark">{st.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        {deliveries.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {deliveries.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {d.role && d.channel !== 'whatsapp'
                    ? `${d.kind !== 'complaint' ? `${t(`kind.${d.kind}` as Key)} · ` : ''}${t(`via.${d.channel}` as Key)} ${t(`to.${d.role}` as Key)}`
                    : t(d.channel === 'sms' ? 'r.sent.sms' : d.channel === 'whatsapp' ? 'r.sent.whatsapp' : d.recipient === rmcEmail ? 'r.sent.email' : 'r.sent.councillorEmail')}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${d.status === 'sent' ? 'bg-sal-soft text-sal-dark' : d.status === 'failed' || d.status === 'skipped' ? 'bg-palash-soft text-palash-dark' : 'bg-haldi-soft text-haldi-text'}`}>
                  {t(`n.${d.status}` as Parameters<typeof t>[0])}
                </span>
              </li>
            ))}
          </ul>
        )}
        {notifyMode() !== 'off' && !r.verifiedAt && r.status !== 'cleared' && <p className="mt-2 text-sm text-muted">{t('r.notSentYet', { m: VERIFY_CONFIRMATIONS })}</p>}
        {events.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-semibold text-jharna-dark">{t('r.history')}</summary>
            <ul className="mt-1 space-y-0.5 text-muted">
              {events.map((e, i) => (
                <li key={i} suppressHydrationWarning>{fmtDate(e.at, lang)} · {t(`ev.${e.kind}` as Parameters<typeof t>[0])}{e.detail ? ` (${e.detail})` : ''}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <ReportActions
        id={r.id}
        upvotes={r.upvotes}
        status={r.status}
        verified={r.verifiedAt != null}
        needed={VERIFY_CONFIRMATIONS}
        radiusM={VERIFY_RADIUS_M}
        reopenThreshold={REOPEN_THRESHOLD}
        summary={summary}
      />

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
        <h2 id="off" className="section-title mb-2">{t('acc.chain')}</h2>
        <AccountabilityChain
          t={t}
          officers={getOfficerChain()}
          elected={elected}
          waText={complaintText(r)}
          draftNote={mla && !assemblyMappingVerified() ? t('acc.draftMap') : null}
        />
        <p className="mt-2 text-xs text-muted">{t('alsoRmc')}: <a className="font-semibold underline" href={`tel:${helpline}`}>{helpline}</a></p>
      </section>
    </article>
  );
}
