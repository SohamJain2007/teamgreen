import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/lang-server';
import { listPublic, wardStatsAll, zoneStatsAll, type Stats } from '@/lib/reports';
import { fmtNum } from '@/lib/format';
import { UnverifiedBadge } from '@/components/ui';
import { Avatar, PartyTag } from '@/components/Accountability';
import { assemblyMappingVerified, getRepresentatives, wardsOfRep } from '@/lib/wards';
import { computeStats } from '@/lib/reports';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Accountability board' };

type Sort = 'open' | 'days' | 'rate' | 'respond';
const rate = (s: Stats) => (s.total ? s.cleared / s.total : null);
const cmp = (sort: Sort) => (a: Stats, b: Stats) => {
  // Worst first. Wards/zones with no data sink to the bottom.
  if (!a.total || !b.total) return (a.total ? 0 : 1) - (b.total ? 0 : 1);
  if (sort === 'open') return b.open - a.open || (b.avgDaysToClear ?? 0) - (a.avgDaysToClear ?? 0);
  if (sort === 'days') return (b.avgDaysToClear ?? -1) - (a.avgDaysToClear ?? -1);
  if (sort === 'respond') return (b.avgDaysToRespond ?? -1) - (a.avgDaysToRespond ?? -1);
  return (rate(a) ?? 0) - (rate(b) ?? 0);
};

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sp = await searchParams;
  const sort: Sort = sp.sort === 'days' || sp.sort === 'rate' || sp.sort === 'respond' ? sp.sort : 'open';
  const { t } = await getT();
  const reports = listPublic();
  const zones = zoneStatsAll(reports).sort((a, b) => cmp(sort)(a.stats, b.stats));
  const wards = wardStatsAll(reports).sort((a, b) => cmp(sort)(a.stats, b.stats));
  const maxOpen = Math.max(1, ...wards.map((w) => w.stats.open));
  const hasDemo = reports.some((r) => r.isDemo);
  const anyUnverified = wards.some((w) => !w.ward.verified);
  const reps = getRepresentatives()
    .map((rep) => {
      const nums = new Set(wardsOfRep(rep).map((w) => w.wardNumber));
      return { rep, wards: nums.size, s: computeStats(reports.filter((r) => r.ward != null && nums.has(r.ward))) };
    })
    .sort((a, b) => b.s.open - a.s.open || (b.s.avgOpenDays ?? 0) - (a.s.avgOpenDays ?? 0));
  const roleKey = { MLA: 'role.mla', MP: 'role.mp', Mayor: 'role.mayor' } as const;

  const Row = ({ label, href, s, i, bar }: { label: React.ReactNode; href?: string; s: Stats; i: number; bar?: number }) => (
    <tr className="border-t border-line">
      <td className="py-2 pl-3 pr-2 text-muted">{s.total ? i + 1 : ''}</td>
      <td className="py-2 pr-2 font-semibold">{href ? <Link href={href} className="hover:underline">{label}</Link> : label}</td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-2">
          <span className="w-6 text-right font-semibold">{s.open}</span>
          {bar != null && <span className="hidden h-2 flex-1 rounded-full bg-line sm:block"><span className="block h-2 rounded-full bg-palash" style={{ width: `${(s.open / bar) * 100}%` }} /></span>}
        </div>
      </td>
      <td className="py-2 pr-2">{s.cleared}</td>
      <td className="py-2 pr-2">{s.total ? fmtNum(s.avgDaysToClear) : '—'}</td>
      <td className="py-2 pr-2">{s.verified ? fmtNum(s.avgDaysToRespond) : '—'}</td>
      <td className="py-2 pr-3">{s.total ? `${Math.round((rate(s) ?? 0) * 100)}%` : t('lb.noReports')}</td>
    </tr>
  );
  const Head = () => (
    <thead className="text-left text-xs uppercase tracking-wide text-muted">
      <tr><th className="py-2 pl-3">#</th><th /><th>{t('lb.open')}</th><th>{t('lb.cleared')}</th><th>{t('lb.avg')}</th><th>{t('lb.respond')}</th><th className="pr-3">{t('lb.rate')}</th></tr>
    </thead>
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl">{t('lb.title')}</h1>
        <p className="text-muted">{t('lb.sub')}</p>
      </header>
      <div className="flex flex-wrap gap-2" role="group">
        {(['open', 'days', 'respond', 'rate'] as const).map((s) => (
          <Link key={s} href={`/leaderboard?sort=${s}`} aria-current={sort === s} className={`chip ${sort === s ? 'chip-on' : ''}`}>
            {t(s === 'open' ? 'lb.sortOpen' : s === 'days' ? 'lb.sortDays' : s === 'respond' ? 'lb.sortRespond' : 'lb.sortRate')}
          </Link>
        ))}
      </div>

      <section>
        <h2 className="section-title">{t('acc.reps')}</h2>
        <p className="mb-2 mt-1 text-sm text-muted">{t('acc.repsSub')}</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {reps.map(({ rep, wards: wn, s }) => (
            <li key={rep.slug}>
              <Link href={`/rep/${rep.slug}`} className="card flex items-center gap-3 p-3 hover:shadow-md">
                <Avatar name={rep.name} party={rep.party} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{rep.name}</span>
                  <PartyTag party={rep.party} role={`${t(roleKey[rep.role])} · ${rep.constituency}`} />
                  <span className="block text-xs text-muted">{wn} {t('acc.wards').toLowerCase()} · {t('acc.avgDays').toLowerCase()} {fmtNum(s.avgOpenDays, 0)}</span>
                </span>
                <span className="text-right">
                  <span className={`block font-display text-2xl leading-none ${s.open ? 'text-palash-dark' : 'text-sal-dark'}`}>{s.open}</span>
                  <span className="text-[11px] font-semibold text-muted">{t('acc.active')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!assemblyMappingVerified() && <p className="mt-2 text-xs text-haldi-text">{t('acc.draftMap')}</p>}
      </section>

      <section>
        <h2 className="section-title mb-2">{t('lb.zones')}</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <Head />
            <tbody>{zones.map((z, i) => <Row key={z.zone} i={i} s={z.stats} label={t(`zone.${z.zone}`)} />)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-title mb-2">{t('lb.wards')}</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <Head />
            <tbody>
              {wards.map((w, i) => (
                <Row key={w.ward.wardNumber} i={i} s={w.stats} bar={maxOpen} href={`/ward/${w.ward.wardNumber}`}
                  label={<>{t('ward.title', { n: w.ward.wardNumber })}{w.ward.name ? <span className="font-normal text-muted"> · {w.ward.name}</span> : null}</>} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted">{t('lb.note')} {hasDemo && <strong>{t('lb.demo')}</strong>}</p>
      {anyUnverified && <UnverifiedBadge />}
    </div>
  );
}
