'use client';
import { useMemo, useState } from 'react';
import { useI18n } from './I18n';
import MapView, { type MapPoint } from './MapView';
import { ReportCard } from './ui';
import { CATEGORIES, STATUSES, ZONES, type Status } from '@/lib/constants';
import type { Report } from '@/lib/reports';

type WardOpt = { n: number; name: string | null; zone: string | null };
type Filters = { ward: string; zone: string; status: string; category: string; date: string };

export default function Tracker({ reports, wards, initial }: { reports: Report[]; wards: WardOpt[]; initial?: Partial<Filters> }) {
  const { t } = useI18n();
  const [f, setF] = useState<Filters>({ ward: '', zone: '', status: '', category: '', date: '', ...initial });
  const [view, setView] = useState<'map' | 'list'>('map');
  const [showFilters, setShowFilters] = useState(false);

  const wardInfo = useMemo(() => new Map(wards.map((w) => [w.n, w])), [wards]);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const active = Object.values(f).filter(Boolean).length;

  const filtered = useMemo(() => {
    const now = Date.now();
    const maxAge = f.date ? Number(f.date) * 86_400_000 : Infinity;
    return reports.filter((r) => {
      if (f.ward && r.ward !== Number(f.ward)) return false;
      if (f.zone && (r.ward == null || wardInfo.get(r.ward)?.zone !== f.zone)) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.category && r.category !== f.category) return false;
      if (now - r.createdAt > maxAge) return false;
      return true;
    });
  }, [reports, f, wardInfo]);

  const points: MapPoint[] = useMemo(
    () =>
      filtered.map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        status: r.status,
        thumb: r.thumb,
        label: r.category ? t(`cat.${r.category}`) : t('r.title'),
        sub: r.ward != null ? t('ward.title', { n: r.ward }) : '',
      })),
    [filtered, t],
  );
  const statusLabels = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, t(`status.${s}`)])) as Record<Status, string>, [t]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">{t('tracker.title')}</h1>
        <p className="text-sm font-semibold text-muted">{t('tracker.count', { n: filtered.length })}</p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setShowFilters((v) => !v)} className="chip" aria-expanded={showFilters}>
          {t('tracker.filters')}{active ? ` (${active})` : ''}
        </button>
        {active > 0 && (
          <button onClick={() => setF({ ward: '', zone: '', status: '', category: '', date: '' })} className="text-sm font-semibold text-jharna-dark underline">
            {t('tracker.clear')}
          </button>
        )}
        <div className="ml-auto flex overflow-hidden rounded-full border border-line md:hidden" role="group">
          {(['map', 'list'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-3 py-1.5 text-sm font-semibold ${view === v ? 'bg-ink text-white' : 'bg-white'}`}>
              {t(v === 'map' ? 'tracker.viewMap' : 'tracker.viewList')}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="card grid grid-cols-2 gap-2 p-3 md:grid-cols-5">
          <Sel label={t('tracker.ward')} value={f.ward} onChange={set('ward')} all={t('tracker.all')}>
            {wards.map((w) => <option key={w.n} value={w.n}>{w.n}{w.name ? ` · ${w.name}` : ''}</option>)}
          </Sel>
          <Sel label={t('tracker.zone')} value={f.zone} onChange={set('zone')} all={t('tracker.all')}>
            {ZONES.map((z) => <option key={z} value={z}>{t(`zone.${z}`)}</option>)}
          </Sel>
          <Sel label={t('tracker.status')} value={f.status} onChange={set('status')} all={t('tracker.all')}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Sel>
          <Sel label={t('tracker.category')} value={f.category} onChange={set('category')} all={t('tracker.all')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
          </Sel>
          <Sel label={t('tracker.date')} value={f.date} onChange={set('date')} all={t('tracker.all')}>
            <option value="7">{t('tracker.last7')}</option>
            <option value="30">{t('tracker.last30')}</option>
          </Sel>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        {STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${s === 'reported' ? 'bg-palash' : s === 'acknowledged' ? 'bg-haldi' : 'bg-sal'}`} />
            {t(`status.${s}`)}
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={view === 'map' ? 'block' : 'hidden md:block'}>
          <div className="md:sticky md:top-20">
            <MapView points={points} statusLabels={statusLabels} openLabel={t('tracker.open')} className="h-[62vh] md:h-[70vh]" />
          </div>
        </div>
        <div className={view === 'list' ? 'block' : 'hidden md:block'}>
          {filtered.length === 0 ? (
            <p className="card p-6 text-center text-muted">{t('tracker.none')}</p>
          ) : (
            <ul className="space-y-2 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
              {filtered.map((r) => (
                <li key={r.id} className="min-w-0">
                  <ReportCard r={r} wardName={r.ward != null ? wardInfo.get(r.ward)?.name : null} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, all, children }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; all: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <select className="field mt-0.5 !min-h-[40px] !py-1.5 text-base font-normal text-ink" value={value} onChange={onChange}>
        <option value="">{all}</option>
        {children}
      </select>
    </label>
  );
}
