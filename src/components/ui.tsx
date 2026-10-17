'use client';
import Link from 'next/link';
import { useI18n, useT } from './I18n';
import { fmtAgo, photoUrl } from '@/lib/format';
import type { Report } from '@/lib/reports';
import type { ReportType, Status } from '@/lib/constants';
import { statusKey, titleKey } from '@/lib/labels';

export const STATUS_STYLE: Record<Status, { bg: string; text: string; dot: string; glyph: string; hex: string }> = {
  reported: { bg: 'bg-palash-soft', text: 'text-palash-dark', dot: 'bg-palash', glyph: '!', hex: '#DD5A26' },
  acknowledged: { bg: 'bg-haldi-soft', text: 'text-haldi-text', dot: 'bg-haldi', glyph: '…', hex: '#C77D0A' },
  cleared: { bg: 'bg-sal-soft', text: 'text-sal-dark', dot: 'bg-sal', glyph: '✓', hex: '#1A7A50' },
};

export function StatusBadge({ status, type }: { status: Status; type?: ReportType }) {
  const t = useT();
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] leading-none text-white ${s.dot}`} aria-hidden="true">
        {s.glyph}
      </span>
      {t(statusKey(status, type))}
    </span>
  );
}

export function UnverifiedBadge({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <span
      title={t('unverified.hint')}
      className={`inline-flex items-center gap-1 rounded-full border border-haldi/50 bg-haldi-soft px-2 py-0.5 text-[11px] font-semibold text-haldi-text ${className}`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
      </svg>
      {t('unverified')}
    </span>
  );
}

export function DemoBadge() {
  const t = useT();
  return <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white">{t('r.demo')}</span>;
}

export function ReportCard({ r, wardName }: { r: Report; wardName?: string | null }) {
  const { t, lang } = useI18n();
  return (
    <Link href={`/r/${r.id}`} className="card flex gap-3 overflow-hidden p-2 transition hover:shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl(r.thumb)} alt="" loading="lazy" width={96} height={96} className="h-24 w-24 shrink-0 rounded-xl bg-line object-cover" />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={r.status} type={r.type} />
          {r.type !== 'garbage' && <TypeTag type={r.type} />}
          {r.isDemo && <DemoBadge />}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {r.category ? t(`cat.${r.category}`) : t(titleKey(r.type))}
            {r.ward != null && <span className="font-normal text-muted"> · {t('ward.title', { n: r.ward })}{wardName ? ` ${wardName}` : ''}</span>}
          </p>
          <p className="text-sm text-muted" suppressHydrationWarning>
            {fmtAgo(r.createdAt, lang)} · {t('r.people', { n: r.upvotes })}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Small label for what a report is about; garbage is the default and goes unlabelled in lists. */
export function TypeTag({ type }: { type: ReportType }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-bold text-ink">
      <TypeIcon type={type} size={12} />
      {t(`type.${type}`)}
    </span>
  );
}

/** Bin, road with a pothole, or tree. */
export const TYPE_ICON: Record<ReportType, string[]> = {
  garbage: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v5M14 11v5'],
  pothole: ['M6 3L3 21', 'M18 3l3 18', 'M12 4v2M12 9v2', 'M8 16.5c0-1.4 1.8-2.5 4-2.5s4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5z'],
  tree: ['M12 21v-6', 'M12 15c-3.9 0-7-2.5-7-6 0-3 2.5-6 7-6s7 3 7 6c0 3.5-3.1 6-7 6z', 'M9 21h6'],
};
export function TypeIcon({ type, size = 20, className = '' }: { type: ReportType; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {TYPE_ICON[type].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
