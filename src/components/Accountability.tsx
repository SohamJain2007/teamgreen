// Public-accountability building blocks: who is responsible for a garbage spot and how they are doing.
// Server components; `t` comes from getT(). Contact menus use <details>, so no client JS is needed.
import Link from 'next/link';
import type { Key } from '@/lib/translations';
import type { Report, Severity, Stats } from '@/lib/reports';
import type { OfficerRole, Representative } from '@/lib/wards';
import { fmtNum, photoUrl } from '@/lib/format';

type T = (k: Key, vars?: Record<string, string | number>) => string;

const PARTY: Record<string, string> = { BJP: '#F26F21', INC: '#1C7CD5', JMM: '#15803D', AJSU: '#B45309' };
const partyColor = (p: string | null | undefined) => (p && PARTY[p]) || '#557066';

export function initials(name: string) {
  return name
    .replace(/^(Shri|Smt\.?|Mr\.?|Mrs\.?|Miss|Dr\.?|Md\.?)\s+/i, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function Avatar({ name, party, size = 48 }: { name: string; party?: string | null; size?: number }) {
  const c = partyColor(party);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl font-display text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${c}, ${c}cc)` }}
      aria-hidden="true"
    >
      {initials(name) || '?'}
    </span>
  );
}

export function PartyTag({ party, role }: { party?: string | null; role: string }) {
  return (
    <span className="text-xs font-semibold">
      {party && <span style={{ color: partyColor(party) }}>{party}</span>}
      {party && role && <span className="text-muted"> · </span>}
      {role && <span className="text-muted">{role}</span>}
    </span>
  );
}

/** Active / Reports / Avg days / Wards tiles. */
export function StatTiles({ t, s, wards }: { t: T; s: Stats; wards?: number }) {
  const tiles = [
    { v: s.open, l: t('acc.active'), c: 'text-palash-dark' },
    { v: s.total, l: t('acc.reports'), c: 'text-haldi-text' },
    { v: fmtNum(s.avgOpenDays, 0), l: t('acc.avgDays'), c: 'text-palash' },
    ...(wards != null ? [{ v: wards, l: t('acc.wards'), c: 'text-ink' }] : [{ v: s.cleared, l: t('acc.cleared'), c: 'text-sal-dark' }]),
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((x) => (
        <div key={x.l} className="card px-1 py-3 text-center">
          <p className={`font-display text-2xl leading-none md:text-3xl ${x.c}`}>{x.v}</p>
          <p className="mt-1 text-[11px] font-semibold text-muted md:text-xs">{x.l}</p>
        </div>
      ))}
    </div>
  );
}

/** "55 garbage dumps across 9 wards remain unresolved ..." */
export function SummaryBox({ t, s, name, wardsWithOpen }: { t: T; s: Stats; name: string; wardsWithOpen: number }) {
  if (!s.open) return <p className="rounded-2xl border border-sal/20 bg-sal-soft p-3 text-sm text-sal-dark">{t('acc.summaryNone', { name })}</p>;
  return (
    <p className="rounded-2xl border border-palash/25 bg-palash-soft p-3 text-sm text-ink">
      {t('acc.summary', { n: s.open, w: wardsWithOpen, name, d: fmtNum(s.avgOpenDays, 0) })}
    </p>
  );
}

export function SeverityChip({ t, sev }: { t: T; sev: Severity }) {
  const cls = sev === 'critical' ? 'bg-palash-soft text-palash-dark' : sev === 'moderate' ? 'bg-haldi-soft text-haldi-text' : 'bg-sal-soft text-sal-dark';
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{t(`sev.${sev}`)}</span>;
}
export const SEV_DOT: Record<Severity, string> = { critical: 'bg-palash', moderate: 'bg-haldi', minor: 'bg-sal' };

/** Numbered list of wards with the most open spots. */
export function WorstWards({ t, rows }: { t: T; rows: { n: number; name: string | null; zone: string | null; open: number }[] }) {
  return (
    <ol className="divide-y divide-line">
      {rows.map((w, i) => (
        <li key={w.n}>
          <Link href={`/ward/${w.n}`} className="flex items-center gap-3 py-2.5 hover:bg-sal-soft/40">
            <span className={`w-6 text-center font-display text-lg ${i < 3 ? 'text-palash' : 'text-muted/50'}`}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{t('ward.title', { n: w.n })}{w.name ? ` · ${w.name}` : ''}</span>
              {w.zone && <span className="font-mono text-xs text-muted">{t(`zone.${w.zone}` as Key)}</span>}
            </span>
            <span className="font-display text-lg text-muted">{w.open}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function RecentList({ t, items }: { t: T; items: { r: Report; sev: Severity | null; title: string; sub: string }[] }) {
  return (
    <ul className="space-y-2">
      {items.map(({ r, sev, title, sub }) => (
        <li key={r.id}>
          <Link href={`/r/${r.id}`} className="card flex items-center gap-3 p-2 hover:shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(r.thumb)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-line object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{title}</span>
              <span className="block truncate text-sm text-muted" suppressHydrationWarning>{sub}</span>
            </span>
            {sev ? <SeverityChip t={t} sev={sev} /> : <span className="shrink-0 rounded-full bg-sal-soft px-2.5 py-1 text-xs font-bold text-sal-dark">{t('sev.resolved')}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type Contact = { name: string; role: string; party?: string | null; phone?: string | null; href?: string; sub?: string };

/** Officer chain (top to bottom) and the elected representatives for one ward. */
export function AccountabilityChain({
  t, officers, elected, waText, draftNote,
}: { t: T; officers: OfficerRole[]; elected: Contact[]; waText: string; draftNote?: string | null }) {
  return (
    <div className="card p-4">
      <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted">{t('acc.chainOfficers')}</p>
      <ol className="flex flex-col items-center">
        {officers.map((o, i) => (
          <li key={o.role} className="flex flex-col items-center text-center">
            {i > 0 && <span className="my-1 h-5 w-px bg-line" aria-hidden="true" />}
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-jharna-soft font-display text-xs text-jharna-dark">
              {o.role.split(/[\s/]+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 3).map((w) => w[0]).join('')}
            </span>
            <span className="mt-1 font-semibold">{o.name ?? o.role}</span>
            <span className="text-xs text-muted">{o.name ? `${o.role} · ` : ''}{o.note}</span>
          </li>
        ))}
      </ol>

      <p className="mb-3 mt-5 border-t border-dashed border-line pt-4 text-center text-[11px] font-bold uppercase tracking-widest text-muted">{t('acc.elected')}</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {elected.map((c) => (
          <li key={c.role + c.name}>
            <ContactCard t={t} c={c} waText={waText} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-xs text-muted">{t('acc.tap')}</p>
      {draftNote && <p className="mt-1 text-center text-[11px] text-haldi-text">{draftNote}</p>}
    </div>
  );
}

function ContactCard({ t, c, waText }: { t: T; c: Contact; waText: string }) {
  const digits = (c.phone ?? '').split('/')[0].replace(/\D/g, '');
  const wa = digits.length === 10 ? `91${digits}` : digits.length === 12 ? digits : null;
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none flex-col items-center rounded-2xl p-2 text-center hover:bg-sal-soft/50 [&::-webkit-details-marker]:hidden">
        <Avatar name={c.name} party={c.party} size={52} />
        <span className="mt-1.5 text-sm font-semibold leading-tight">{c.name}</span>
        <PartyTag party={c.party} role={c.role} />
        {c.sub && <span className="text-[11px] text-muted">{c.sub}</span>}
      </summary>
      <div className="absolute left-1/2 top-full z-20 mt-1 w-48 -translate-x-1/2 rounded-xl border border-line bg-white p-1.5 text-sm shadow-lg">
        {digits ? (
          <>
            <a href={`tel:${digits}`} className="block rounded-lg px-3 py-2 font-semibold hover:bg-sal-soft">📞 {t('acc.call')} {digits}</a>
            {wa && (
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-3 py-2 font-semibold hover:bg-sal-soft">
                💬 {t('acc.whatsapp')}
              </a>
            )}
          </>
        ) : (
          <p className="px-3 py-2 text-muted">{t('acc.noPhone')}</p>
        )}
        {c.href && <Link href={c.href} className="block rounded-lg px-3 py-2 font-semibold text-jharna-dark hover:bg-jharna-soft">{t('acc.profile')} →</Link>}
      </div>
    </details>
  );
}
