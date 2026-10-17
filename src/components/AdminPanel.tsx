'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from './I18n';
import { StatusBadge, DemoBadge, TypeTag } from './ui';
import { titleKey } from '@/lib/labels';
import { REPORT_TYPES, ROADS, type ReportType } from '@/lib/constants';
import { daysBetween, fmtAgo, photoUrl } from '@/lib/format';
import type { Report } from '@/lib/reports';
import type { Admin, AuditEntry } from '@/lib/admins';
import type { Key } from '@/lib/translations';
import Link from 'next/link';
import { ActivityLog, ChangePassword, LogoutButton, RoleBadge, TeamManager } from './AdminTeam';
import AdminData, { type AdminDataProps } from './AdminData';

type Tab = 'open' | 'flagged' | 'cleared' | 'all';
type Section = 'reports' | 'data' | 'activity' | 'team' | 'account';

export function AdminLogin({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (disabled) return <p className="card p-4 font-semibold text-palash-dark">{t('admin.disabled')}</p>;
  return (
    <form
      className="card mx-auto max-w-sm space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: pw }) }).catch(() => null);
        setBusy(false);
        if (r?.ok) return router.refresh();
        setPw('');
        setErr(t(r?.status === 429 ? 'admin.err.rate' : r?.status === 401 ? 'admin.wrong' : 'admin.err.generic'));
      }}
    >
      <h1 className="text-2xl">{t('admin.title')}</h1>
      <label className="block text-sm font-semibold">
        {t('admin.username')}
        <input
          className="field mt-1"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <label className="block text-sm font-semibold">
        {t('admin.password')}
        <input type="password" className="field mt-1" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="current-password" />
      </label>
      {err && <p className="text-sm font-semibold text-palash-dark" role="alert">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{t('admin.login')}</button>
    </form>
  );
}

type Delivery = { channel: string; status: string; error: string | null };

/** Shown instead of the panel until someone replaces a password an owner set for them. */
export function AdminMustChange({ me }: { me: Admin }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">{t('admin.title')}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{t('admin.signedInAs', { name: me.name })}</span>
          <LogoutButton />
        </div>
      </div>
      <ChangePassword forced />
    </div>
  );
}

type Props = {
  me: Admin;
  reports: Report[];
  deliveries: Record<string, Delivery[]>;
  mode: string;
  needed: number;
  admins: Admin[];
  activity: AuditEntry[];
  lastActions: Record<string, AuditEntry>;
  data: AdminDataProps;
};

export default function AdminPanel({ me, reports, deliveries, mode, needed, admins, activity, lastActions, data }: Props) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [section, setSection] = useState<Section>('reports');
  const [tab, setTab] = useState<Tab>('open');
  const [typeFilter, setTypeFilter] = useState<ReportType | ''>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const inTab = (k: Tab, r: Report) =>
    k === 'open' ? r.status !== 'cleared' && !r.hidden : k === 'cleared' ? r.status === 'cleared' : k === 'flagged' ? r.hidden || r.spamFlags > 0 : true;
  const ofType = reports.filter((r) => !typeFilter || r.type === typeFilter);
  const shown = ofType.filter((r) => inTab(tab, r));

  async function act(id: string, action: string, after?: File | null, extra?: Record<string, string>) {
    if (action === 'delete' && !confirm(t('admin.confirmDelete'))) return;
    setBusy(id);
    const fd = new FormData();
    fd.append('action', action);
    if (after) fd.append('after', after);
    for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v);
    const r = await fetch(`/api/admin/reports/${id}`, { method: 'POST', body: fd }).catch(() => null);
    setBusy(null);
    setMsg(r?.ok ? t('admin.saved') : t('admin.failed'));
    setTimeout(() => setMsg(null), 2000);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">{t('admin.title')}</h1>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm font-semibold text-sal-dark" role="status">{msg}</span>}
          <span className="flex items-center gap-1.5 text-sm text-muted">
            {t('admin.signedInAs', { name: me.name })} <RoleBadge role={me.role} />
          </span>
          <LogoutButton />
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-line pb-3" aria-label={t('admin.title')}>
        {(['reports', 'data', 'activity', ...(me.role === 'owner' ? ['team' as const] : []), 'account'] as const).map((k) => (
          <button key={k} aria-current={section === k ? 'page' : undefined} onClick={() => setSection(k)} className={`chip ${section === k ? 'chip-on' : ''}`}>
            {t(`admin.section.${k}`)}
          </button>
        ))}
      </nav>
      {section === 'data' && <AdminData {...data} />}
      {section === 'activity' && <ActivityLog entries={activity} />}
      {section === 'team' && me.role === 'owner' && <TeamManager me={me} admins={admins} />}
      {section === 'account' && <ChangePassword />}
      {section === 'reports' && (
        <>
          <p className={`rounded-xl p-3 text-sm font-semibold ${mode === 'live' ? 'bg-sal-soft text-sal-dark' : 'bg-haldi-soft text-haldi-text'}`}>
            {t(mode === 'live' ? 'admin.mode.live' : mode === 'dry-run' ? 'admin.mode.dry' : 'admin.mode.off')}
          </p>
          <div className="flex flex-wrap gap-2" role="tablist">
            {(['open', 'flagged', 'cleared', 'all'] as const).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-on' : ''}`}>
                {t(`admin.tab.${k}`)} ({ofType.filter((r) => inTab(k, r)).length})
              </button>
            ))}
            <select
              className="field !min-h-[36px] !w-auto !py-1 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ReportType | '')}
              aria-label={t('tracker.type')}
            >
              <option value="">{t('admin.type.all')}</option>
              {REPORT_TYPES.map((k) => <option key={k} value={k}>{t(`type.${k}`)}</option>)}
            </select>
          </div>
          {shown.length === 0 && <p className="card p-4 text-sm text-muted">{t('admin.empty')}</p>}
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.id} className={`card p-3 ${r.hidden ? 'opacity-70' : ''}`}>
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(r.thumb)} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={r.status} type={r.type} />
                      <TypeTag type={r.type} />
                      {r.isDemo && <DemoBadge />}
                      {r.hidden && <span className="rounded bg-palash px-1.5 py-0.5 text-[10px] font-bold text-white">{t('admin.hidden')}</span>}
                      {r.spamFlags > 0 && <span className="text-xs font-semibold text-palash-dark">{t('admin.flags', { n: r.spamFlags })}</span>}
                    </div>
                    <Link href={`/r/${r.id}`} className="block font-semibold underline">
                      #{r.id} · {r.category ? t(`cat.${r.category}`) : t(titleKey(r.type))}{r.ward != null ? ` · ${t('ward.title', { n: r.ward })}` : ''}
                    </Link>
                    <p className="text-sm text-muted" suppressHydrationWarning>
                      {fmtAgo(r.createdAt, lang)} · {t('r.daysOpen', { n: daysBetween(r.createdAt, r.clearedAt ?? Date.now()) })} · 👥 {r.upvotes}
                    </p>
                    {r.note && <p className="truncate text-sm">{r.note}</p>}
                    {r.type === 'pothole' && (
                      <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                        {t('admin.road')}
                        <select
                          className="field !min-h-[32px] !w-auto !py-0.5 text-sm font-normal text-ink"
                          value={r.road ?? ''}
                          disabled={busy === r.id}
                          onChange={(e) => act(r.id, 'set_road', null, { road: e.target.value })}
                        >
                          {!r.road && <option value="">—</option>}
                          {ROADS.map((k) => <option key={k} value={k}>{t(`road.${k}`)}</option>)}
                        </select>
                      </label>
                    )}
                    <p className="text-xs">
                      {r.verifiedAt ? <span className="font-semibold text-jharna-dark">✓ {t('step.verified')}</span> : <span className="text-muted">{t('r.confirmProgress', { n: Math.max(0, r.upvotes - 1), m: needed })}</span>}
                      {(deliveries[r.id] ?? []).map((d, i) => (
                        <span key={i} title={d.error ?? ''} className={`ml-2 rounded px-1.5 py-0.5 font-semibold ${d.status === 'sent' ? 'bg-sal-soft text-sal-dark' : d.status === 'failed' || d.status === 'skipped' ? 'bg-palash-soft text-palash-dark' : 'bg-haldi-soft text-haldi-text'}`}>
                          {d.channel}: {d.status}{d.error ? ` (${d.error.slice(0, 60)})` : ''}
                        </span>
                      ))}
                    </p>
                    {lastActions[r.id] && (
                      <p className="text-xs text-muted" suppressHydrationWarning>
                        {t('admin.lastBy', {
                          action: t(`admin.act.${lastActions[r.id].action}` as Key),
                          name: lastActions[r.id].adminName ?? t('admin.system'),
                          ago: fmtAgo(lastActions[r.id].at, lang),
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!r.verifiedAt && !r.hidden && <button disabled={busy === r.id} onClick={() => act(r.id, 'verify')} className="btn-ghost !min-h-[40px] !py-1.5">{t('admin.verify')}</button>}
                  {(deliveries[r.id] ?? []).some((d) => d.status === 'failed') && <button disabled={busy === r.id} onClick={() => act(r.id, 'retry')} className="btn-ghost !min-h-[40px] !py-1.5">{t('admin.retry')}</button>}
                  {r.status === 'reported' && <button disabled={busy === r.id} onClick={() => act(r.id, 'acknowledge')} className="btn-ghost !min-h-[40px] !py-1.5">{t('admin.ack')}</button>}
                  {r.status !== 'cleared' && (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = (e.currentTarget.elements.namedItem('after') as HTMLInputElement).files?.[0];
                        act(r.id, 'clear', f);
                      }}
                    >
                      <label className="text-xs font-semibold text-muted">
                        {t('admin.afterPhoto')}
                        <input name="after" type="file" accept="image/*" className="ml-1 max-w-[12rem] text-xs" />
                      </label>
                      <button disabled={busy === r.id} className="btn-primary !min-h-[40px] !py-1.5">{t('admin.clear')}</button>
                    </form>
                  )}
                  {r.status !== 'reported' && <button disabled={busy === r.id} onClick={() => act(r.id, 'reopen')} className="btn-ghost !min-h-[40px] !py-1.5">{t('admin.reopen')}</button>}
                  {r.hidden ? (
                    <button disabled={busy === r.id} onClick={() => act(r.id, 'restore')} className="btn-ghost !min-h-[40px] !py-1.5">{t('admin.restore')}</button>
                  ) : (
                    <button disabled={busy === r.id} onClick={() => act(r.id, 'hide')} className="btn-ghost !min-h-[40px] !py-1.5">{t('admin.hide')}</button>
                  )}
                  {me.role === 'owner' && (
                    <button disabled={busy === r.id} onClick={() => act(r.id, 'delete')} className="ml-auto text-sm font-semibold text-palash-dark underline">{t('admin.delete')}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
