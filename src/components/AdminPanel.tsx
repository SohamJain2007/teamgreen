'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from './I18n';
import { StatusBadge, DemoBadge } from './ui';
import { daysBetween, fmtAgo, photoUrl } from '@/lib/format';
import type { Report } from '@/lib/reports';
import Link from 'next/link';

type Tab = 'open' | 'flagged' | 'cleared' | 'all';

export function AdminLogin({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  if (disabled) return <p className="card p-4 font-semibold text-palash-dark">{t('admin.disabled')}</p>;
  return (
    <form
      className="card mx-auto max-w-sm space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
        if (r.ok) router.refresh();
        else setErr(true);
      }}
    >
      <label className="block text-sm font-semibold">
        {t('admin.password')}
        <input type="password" className="field mt-1" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
      </label>
      {err && <p className="text-sm font-semibold text-palash-dark" role="alert">{t('admin.wrong')}</p>}
      <button className="btn-primary w-full">{t('admin.login')}</button>
    </form>
  );
}

export default function AdminPanel({ reports }: { reports: Report[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('open');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const shown = reports.filter((r) =>
    tab === 'open' ? r.status !== 'cleared' && !r.hidden : tab === 'cleared' ? r.status === 'cleared' : tab === 'flagged' ? r.hidden || r.spamFlags > 0 : true,
  );

  async function act(id: string, action: string, after?: File | null) {
    if (action === 'delete' && !confirm(t('admin.confirmDelete'))) return;
    setBusy(id);
    const fd = new FormData();
    fd.append('action', action);
    if (after) fd.append('after', after);
    const r = await fetch(`/api/admin/reports/${id}`, { method: 'POST', body: fd });
    setBusy(null);
    setMsg(r.ok ? t('admin.saved') : t('admin.failed'));
    setTimeout(() => setMsg(null), 2000);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">{t('admin.title')}</h1>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm font-semibold text-sal-dark" role="status">{msg}</span>}
          <button
            className="btn-ghost !min-h-[40px] !py-1.5"
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST' });
              router.refresh();
            }}
          >
            {t('admin.logout')}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {(['open', 'flagged', 'cleared', 'all'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-on' : ''}`}>
            {t(`admin.tab.${k}`)}
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className={`card p-3 ${r.hidden ? 'opacity-70' : ''}`}>
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(r.thumb)} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={r.status} />
                  {r.isDemo && <DemoBadge />}
                  {r.hidden && <span className="rounded bg-palash px-1.5 py-0.5 text-[10px] font-bold text-white">{t('admin.hidden')}</span>}
                  {r.spamFlags > 0 && <span className="text-xs font-semibold text-palash-dark">{t('admin.flags', { n: r.spamFlags })}</span>}
                </div>
                <Link href={`/r/${r.id}`} className="block font-semibold underline">
                  #{r.id} · {r.category ? t(`cat.${r.category}`) : t('r.title')}{r.ward != null ? ` · ${t('ward.title', { n: r.ward })}` : ''}
                </Link>
                <p className="text-sm text-muted" suppressHydrationWarning>
                  {fmtAgo(r.createdAt, lang)} · {t('r.daysOpen', { n: daysBetween(r.createdAt, r.clearedAt ?? Date.now()) })} · 👥 {r.upvotes}
                </p>
                {r.note && <p className="truncate text-sm">{r.note}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
              <button disabled={busy === r.id} onClick={() => act(r.id, 'delete')} className="ml-auto text-sm font-semibold text-palash-dark underline">{t('admin.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
