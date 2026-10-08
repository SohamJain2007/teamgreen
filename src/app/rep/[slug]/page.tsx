import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/lang-server';
import { computeStats, listPublic, severity } from '@/lib/reports';
import { assemblyMappingVerified, getRep, getWard, wardsOfRep } from '@/lib/wards';
import { fmtAgo } from '@/lib/format';
import { Avatar, PartyTag, RecentList, StatTiles, SummaryBox, WorstWards } from '@/components/Accountability';
import ShareButton from '@/components/ShareButton';
import { UnverifiedBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const rep = getRep((await params).slug);
  return { title: rep ? `${rep.name}, ${rep.role} ${rep.constituency}: garbage record` : 'Not found' };
}

export default async function RepPage({ params }: { params: Promise<{ slug: string }> }) {
  const rep = getRep((await params).slug);
  if (!rep) notFound();
  const { t, lang } = await getT();
  const wards = wardsOfRep(rep);
  const nums = new Set(wards.map((w) => w.wardNumber));
  const reports = listPublic().filter((r) => r.ward != null && nums.has(r.ward));
  const s = computeStats(reports);
  const now = Date.now();

  const openByWard = new Map<number, number>();
  for (const r of reports) if (r.status !== 'cleared') openByWard.set(r.ward!, (openByWard.get(r.ward!) ?? 0) + 1);
  const worst = [...openByWard.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n, open]) => ({ n, open, name: getWard(n)?.name ?? null, zone: getWard(n)?.zone ?? null }));
  const recent = reports.slice(0, 8).map((r) => ({
    r,
    sev: r.status === 'cleared' ? null : severity(r, now),
    title: `${t('ward.title', { n: r.ward! })}${getWard(r.ward!)?.name ? ` · ${getWard(r.ward!)!.name}` : ''}`,
    sub: `${r.note ?? (r.category ? t(`cat.${r.category}`) : t('r.title'))} · ${fmtAgo(r.createdAt, lang, now)}`,
  }));
  const roleLabel = t(rep.role === 'MLA' ? 'role.mla' : rep.role === 'MP' ? 'role.mp' : 'role.mayor');
  const draft = rep.role === 'MLA' && !assemblyMappingVerified();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-3">
        <Avatar name={rep.name} party={rep.party} size={60} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl">{rep.name}</h1>
          <p className="text-sm">
            <span className="text-muted">{roleLabel} · {rep.constituency}</span>
            {rep.party && <> · <PartyTag party={rep.party} role="" /></>}
          </p>
        </div>
        <ShareButton title={`${rep.name}: garbage record`} label={t('r.share')} copiedLabel={t('r.copied')} />
      </header>

      <StatTiles t={t} s={s} wards={wards.length} />
      <SummaryBox t={t} s={s} name={rep.name} wardsWithOpen={openByWard.size} />
      {draft && <p className="flex items-center gap-2 text-xs text-haldi-text"><UnverifiedBadge /> {t('acc.draftMap')}</p>}

      <section>
        <h2 className="mb-1 font-mono text-xs font-bold uppercase tracking-widest text-muted">{t('acc.worstWards')}</h2>
        {worst.length ? <WorstWards t={t} rows={worst} /> : <p className="text-sm text-muted">{t('acc.noOpen')}</p>}
      </section>

      <section>
        <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">{t('acc.recent')}</h2>
        {recent.length ? <RecentList t={t} items={recent} /> : <p className="text-sm text-muted">{t('home.empty.t')}</p>}
      </section>

      <section>
        <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">{t('acc.wardList', { n: wards.length })}</h2>
        <p className="text-sm leading-relaxed">
          {wards.map((w, i) => (
            <span key={w.wardNumber}>
              {i > 0 && ', '}
              <a href={`/ward/${w.wardNumber}`} className="text-jharna-dark underline">{w.wardNumber}{w.name ? ` ${w.name}` : ''}</a>
            </span>
          ))}
        </p>
      </section>
    </div>
  );
}
