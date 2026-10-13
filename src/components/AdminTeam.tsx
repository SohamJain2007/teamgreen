'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from './I18n';
import { fmtAgo, fmtDate } from '@/lib/format';
import type { Key } from '@/lib/translations';
import type { Admin, AuditEntry, Role } from '@/lib/admins';

const SMALL_BTN = 'btn-ghost !min-h-[40px] !py-1.5 text-sm';

/** Turns an API error code into a sentence; unknown codes get the generic message. */
function useErrText() {
  const { t } = useI18n();
  return (code: string | undefined) => {
    const k = `admin.err.${code}` as Key;
    return code && t(k) !== k ? t(k) : t('admin.err.generic');
  };
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, error: data.error };
  } catch {
    return { ok: false };
  }
}

/** 16 characters without look-alikes (no 0/O, 1/l/I), from the browser's secure random source. */
export function tempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(16)), (x) => alphabet[x % alphabet.length]).join('');
}

export function LogoutButton() {
  const { t } = useI18n();
  return (
    <button
      className={SMALL_BTN}
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => null);
        // Full reload, so no admin data stays in the client router cache.
        window.location.assign('/admin');
      }}
    >
      {t('admin.logout')}
    </button>
  );
}

export function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const errText = useErrText();
  const [f, setF] = useState({ current: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="card max-w-md space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (f.password !== f.confirm) return setMsg({ ok: false, text: t('admin.pw.mismatch') });
        setBusy(true);
        const r = await post('/api/admin/password', { current: f.current, password: f.password });
        setBusy(false);
        setMsg(r.ok ? { ok: true, text: t('admin.pw.done') } : { ok: false, text: errText(r.error) });
        if (r.ok) {
          setF({ current: '', password: '', confirm: '' });
          router.refresh();
        }
      }}
    >
      <h2 className="text-xl">{t('admin.pw.title')}</h2>
      {forced && <p className="rounded-xl bg-haldi-soft p-3 text-sm font-semibold text-haldi-text">{t('admin.pw.forced')}</p>}
      <label className="block text-sm font-semibold">
        {t('admin.pw.current')}
        <input type="password" className="field mt-1" value={f.current} onChange={set('current')} autoComplete="current-password" required />
      </label>
      <label className="block text-sm font-semibold">
        {t('admin.pw.new')}
        <input type="password" className="field mt-1" value={f.password} onChange={set('password')} autoComplete="new-password" minLength={12} required />
      </label>
      <label className="block text-sm font-semibold">
        {t('admin.pw.confirm')}
        <input type="password" className="field mt-1" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" minLength={12} required />
      </label>
      <p className="text-xs text-muted">{t('admin.pw.hint')}</p>
      {msg && (
        <p className={`text-sm font-semibold ${msg.ok ? 'text-sal-dark' : 'text-palash-dark'}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
      <button className="btn-primary w-full" disabled={busy}>{t('admin.pw.save')}</button>
    </form>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n();
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${role === 'owner' ? 'bg-jharna text-white' : 'bg-sal-soft text-sal-dark'}`}>
      {t(`admin.role.${role}`)}
    </span>
  );
}

export function TeamManager({ me, admins }: { me: Admin; admins: Admin[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const errText = useErrText();
  const [form, setForm] = useState({ name: '', username: '', role: 'staff' as Role, password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    const r = await post('/api/admin/team', body);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: success } : { ok: false, text: errText(r.error) });
    if (r.ok) router.refresh();
    return r.ok;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('admin.team.sub')}</p>
      {msg && (
        <p className={`rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-sal-soft text-sal-dark' : 'bg-palash-soft text-palash-dark'}`} role={msg.ok ? 'status' : 'alert'}>
          <span className="select-all">{msg.text}</span>
        </p>
      )}
      <ul className="space-y-2">
        {admins.map((a) => (
          <li key={a.id} className={`card flex flex-wrap items-center gap-3 p-3 ${a.active ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                {a.name}
                <span className="font-normal text-muted">@{a.username}</span>
                <RoleBadge role={a.role} />
                {a.id === me.id && <span className="text-xs text-muted">({t('admin.team.you')})</span>}
                {!a.active && <span className="rounded bg-palash px-1.5 py-0.5 text-[11px] font-bold text-white">{t('admin.team.inactive')}</span>}
              </p>
              <p className="text-xs text-muted" suppressHydrationWarning>
                {a.lastLoginAt ? t('admin.team.lastLogin', { ago: fmtAgo(a.lastLoginAt, lang) }) : t('admin.team.never')}
                {a.mustChange && a.active ? ` · ${t('admin.team.mustChange')}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={SMALL_BTN}
                disabled={busy}
                onClick={() => {
                  const name = prompt(t('admin.team.renamePrompt'), a.name)?.trim();
                  if (name && name !== a.name) run({ action: 'update', id: a.id, name }, t('admin.saved'));
                }}
              >
                {t('admin.team.rename')}
              </button>
              {a.id !== me.id && (
                <>
                  {a.active && (
                    <button
                      className={SMALL_BTN}
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(t('admin.team.confirmReset', { name: a.name }))) return;
                        const pw = tempPassword();
                        run({ action: 'reset', id: a.id, password: pw }, t('admin.team.resetDone', { user: a.username, pw }));
                      }}
                    >
                      {t('admin.team.reset')}
                    </button>
                  )}
                  {a.active && (
                    <button className={SMALL_BTN} disabled={busy} onClick={() => run({ action: 'update', id: a.id, role: a.role === 'owner' ? 'staff' : 'owner' }, t('admin.saved'))}>
                      {t(a.role === 'owner' ? 'admin.team.makeStaff' : 'admin.team.makeOwner')}
                    </button>
                  )}
                  <button
                    className={SMALL_BTN}
                    disabled={busy}
                    onClick={() => {
                      if (a.active && !confirm(t('admin.team.confirmDeactivate', { name: a.name }))) return;
                      run({ action: 'update', id: a.id, active: !a.active }, t('admin.saved'));
                    }}
                  >
                    {t(a.active ? 'admin.team.deactivate' : 'admin.team.reactivate')}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form
        className="card max-w-md space-y-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run({ action: 'create', ...form }, t('admin.team.created', { user: form.username.trim().toLowerCase(), pw: form.password }));
          if (ok) setForm({ name: '', username: '', role: 'staff', password: '' });
        }}
      >
        <h2 className="text-xl">{t('admin.team.add')}</h2>
        <label className="block text-sm font-semibold">
          {t('admin.team.name')}
          <input className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required autoComplete="off" />
        </label>
        <label className="block text-sm font-semibold">
          {t('admin.username')}
          <input
            className="field mt-1"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
            pattern="[a-z0-9._\-]{3,32}"
            title={t('admin.err.bad_username')}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <fieldset className="text-sm font-semibold">
          <legend>{t('admin.team.role')}</legend>
          <div className="mt-1 flex gap-2">
            {(['staff', 'owner'] as const).map((r) => (
              <button type="button" key={r} aria-pressed={form.role === r} onClick={() => setForm({ ...form, role: r })} className={`chip ${form.role === r ? 'chip-on' : ''}`}>
                {t(`admin.role.${r}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold">
          {t('admin.team.tempPw')}
          <span className="mt-1 flex gap-2">
            <input className="field font-mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={12} required autoComplete="off" spellCheck={false} />
            <button type="button" className={SMALL_BTN} onClick={() => setForm({ ...form, password: tempPassword() })}>
              {t('admin.team.generate')}
            </button>
          </span>
        </label>
        <p className="text-xs text-muted">{t('admin.team.tempHint')}</p>
        <button className="btn-primary w-full" disabled={busy}>{t('admin.team.create')}</button>
      </form>
    </div>
  );
}

export function ActivityLog({ entries }: { entries: AuditEntry[] }) {
  const { t, lang } = useI18n();
  if (!entries.length) return <p className="text-sm text-muted">{t('admin.activity.empty')}</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t('admin.activity.sub')}</p>
      <ul className="card divide-y divide-line">
        {entries.map((e, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 text-sm">
            <span className="w-full shrink-0 text-xs text-muted sm:w-40" suppressHydrationWarning>{fmtDate(e.at, lang)}</span>
            <span className="font-semibold">{e.adminName ?? t('admin.system')}</span>
            <span>{t(`admin.act.${e.action}` as Key) === `admin.act.${e.action}` ? e.action : t(`admin.act.${e.action}` as Key)}</span>
            {e.reportId && <Link href={`/r/${e.reportId}`} className="font-semibold underline">#{e.reportId}</Link>}
            {e.detail && <span className="text-muted">{e.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
