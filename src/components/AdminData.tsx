'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from './I18n';
import LocationPicker from './LocationPicker';
import { fmtAgo } from '@/lib/format';
import { ZONES } from '@/lib/constants';
import type { Key } from '@/lib/translations';
import type { Official, Representative, Ward } from '@/lib/wards';
import type { EditInfo, Readiness } from '@/lib/ward-edits';

const SMALL_BTN = 'btn-ghost !min-h-[40px] !py-1.5 text-sm';

type Values = Record<string, unknown>;
type Field =
  | { name: string; label: Key; hint?: Key; kind: 'text' | 'email' | 'tel' | 'textarea' | 'bool' }
  | { name: string; label: Key; hint?: Key; kind: 'select'; options: { value: string; label: string }[] }
  | { name: 'location'; label: Key; hint?: Key; kind: 'location' };

export type EscalationRow = { role: string; title: string; name: string | null; email: string | null; phone: string | null; verified: boolean };
export type AdminDataProps = {
  wards: Ward[];
  escalation: EscalationRow[];
  officials: Official[];
  reps: Representative[];
  helpline: { phone: string; email: string };
  assemblyVerified: boolean | null;
  edits: Record<string, EditInfo>;
  readiness: Readiness;
};

async function post(body: unknown): Promise<{ ok: boolean; error?: string; field?: string; changed?: number }> {
  try {
    const r = await fetch('/api/admin/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, ...d };
  } catch {
    return { ok: false };
  }
}

function Badge({ tone, children }: { tone: 'bad' | 'warn' | 'ok' | 'info'; children: React.ReactNode }) {
  const cls = { bad: 'bg-palash-soft text-palash-dark', warn: 'bg-haldi-soft text-haldi-text', ok: 'bg-sal-soft text-sal-dark', info: 'bg-jharna-soft text-jharna-dark' }[tone];
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

/** An edit form for one entity (ward, official, ...). Sends only the fields shown; the server keeps only real changes. */
function EntityForm({ dataKey, title, fields, initial, edit, onClose }: { dataKey: string; title: string; fields: Field[]; initial: Values; edit?: EditInfo; onClose: () => void }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, val: unknown) => setV((x) => ({ ...x, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const values: Values = {};
    for (const f of fields) {
      if (f.kind === 'location') {
        values.lat = v.lat ?? null;
        values.lng = v.lng ?? null;
      } else values[f.name] = v[f.name] ?? (f.kind === 'bool' ? false : '');
    }
    const r = await post({ action: 'save', key: dataKey, values });
    setBusy(false);
    if (!r.ok) {
      const k = `data.err.${r.error}` as Key;
      const field = fields.find((f) => f.name === r.field || (f.kind === 'location' && r.field === 'lat'));
      return setErr(`${field ? `${t(field.label)}: ` : ''}${t(k) === k ? t('admin.err.generic') : t(k)}`);
    }
    router.refresh();
    onClose();
  }

  async function reset() {
    if (!confirm(t('data.confirmReset', { what: title }))) return;
    setBusy(true);
    await post({ action: 'reset', key: dataKey });
    setBusy(false);
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3 border-t border-line pt-3">
      {fields.map((f) => {
        const hint = f.hint && <span className="mt-0.5 block text-xs font-normal text-muted">{t(f.hint)}</span>;
        if (f.kind === 'bool')
          return (
            <label key={f.name} className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#1A7A50]" checked={!!v[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
              <span>
                {t(f.label)}
                {hint}
              </span>
            </label>
          );
        if (f.kind === 'location') {
          const has = v.lat != null && v.lng != null;
          return (
            <div key="location" className="text-sm font-semibold">
              {t(f.label)}
              {hint}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-normal">{has ? `${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}` : t('data.notSet')}</span>
                <button type="button" className={SMALL_BTN} onClick={() => setShowMap((s) => !s)}>
                  {t(showMap ? 'data.hideMap' : 'data.setOnMap')}
                </button>
                {has && (
                  <button type="button" className="text-xs font-semibold text-palash-dark underline" onClick={() => setV((x) => ({ ...x, lat: null, lng: null }))}>
                    {t('data.clearLocation')}
                  </button>
                )}
              </div>
              {showMap && (
                <div className="mt-2">
                  <LocationPicker value={has ? { lat: Number(v.lat), lng: Number(v.lng) } : null} onChange={(lat, lng) => setV((x) => ({ ...x, lat, lng }))} />
                </div>
              )}
            </div>
          );
        }
        return (
          <label key={f.name} className="block text-sm font-semibold">
            {t(f.label)}
            {hint}
            {f.kind === 'select' ? (
              <select className="field mt-1 font-normal" value={String(v[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)}>
                <option value="">—</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.kind === 'textarea' ? (
              <textarea className="field mt-1 font-normal" rows={2} maxLength={400} value={String(v[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} />
            ) : (
              <input
                className="field mt-1 font-normal"
                type={f.kind}
                inputMode={f.kind === 'tel' ? 'tel' : f.kind === 'email' ? 'email' : undefined}
                value={String(v[f.name] ?? '')}
                onChange={(e) => set(f.name, e.target.value)}
                maxLength={f.kind === 'tel' ? 40 : 120}
              />
            )}
          </label>
        );
      })}
      {err && (
        <p className="rounded-xl bg-palash-soft p-3 text-sm font-semibold text-palash-dark" role="alert">
          {err}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary !min-h-[40px] !py-1.5" disabled={busy}>
          {t('data.save')}
        </button>
        <button type="button" className={SMALL_BTN} onClick={onClose}>
          {t('data.cancel')}
        </button>
        {edit && (
          <button type="button" className="ml-auto text-sm font-semibold text-palash-dark underline" onClick={reset} disabled={busy}>
            {t('data.reset')}
          </button>
        )}
      </div>
      {edit && (
        <p className="text-xs text-muted" suppressHydrationWarning>
          {t('data.editedBy', { name: edit.by ?? t('admin.system'), ago: fmtAgo(edit.at, lang) })}
        </p>
      )}
    </form>
  );
}

/** A card that shows a summary and opens its edit form in place. */
function Editable({ summary, ...form }: { summary: React.ReactNode } & Omit<Parameters<typeof EntityForm>[0], 'onClose'>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <li className="card p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{summary}</div>
        {!open && (
          <button className={SMALL_BTN} onClick={() => setOpen(true)}>
            {t('data.edit')}
          </button>
        )}
      </div>
      {open && <EntityForm {...form} onClose={() => setOpen(false)} />}
    </li>
  );
}

function ReadinessCard({ r }: { r: Readiness }) {
  const { t } = useI18n();
  const items: { ok: boolean; text: string }[] = [
    { ok: r.mode === 'live', text: t(`data.ready.mode.${r.mode}`) },
    { ok: r.email, text: t(r.email ? 'data.ready.email.ok' : 'data.ready.email.no') },
    { ok: r.sms, text: t(r.sms ? 'data.ready.sms.ok' : 'data.ready.sms.no') },
    ...r.escalation.map((e) => ({
      ok: e.reachable && e.verified,
      text: t(!e.reachable ? 'data.ready.esc.missing' : !e.verified ? 'data.ready.esc.unverified' : 'data.ready.esc.ok', { title: e.title }),
    })),
  ];
  if (r.wardsUnreachable.length) items.push({ ok: false, text: t('data.ready.unreachable', { list: r.wardsUnreachable.join(', ') }) });
  if (r.wardsUnverified.length) items.push({ ok: false, text: t('data.ready.unverified', { list: r.wardsUnverified.join(', ') }) });
  if (!r.wardsUnreachable.length && !r.wardsUnverified.length) items.push({ ok: true, text: t('data.ready.wardsOk') });
  if (r.wardsNoLocation.length) items.push({ ok: false, text: t('data.ready.noLocation', { list: r.wardsNoLocation.join(', ') }) });
  if (r.assemblyDraft) items.push({ ok: false, text: t('data.ready.assembly') });
  const todo = items.filter((i) => !i.ok);

  return (
    <section className="card space-y-2 p-4">
      <h2 className="text-xl">{t('data.ready.title')}</h2>
      {!todo.length && <p className="font-semibold text-sal-dark">{t('data.ready.allGood')}</p>}
      <ul className="space-y-1.5 text-sm">
        {[...todo, ...items.filter((i) => i.ok)].map((i, n) => (
          <li key={n} className="flex gap-2">
            <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${i.ok ? 'bg-sal' : 'bg-palash'}`}>
              {i.ok ? '✓' : '!'}
            </span>
            <span className={i.ok ? 'text-muted' : ''}>{i.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminData(p: AdminDataProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'attention' | 'edited'>('attention');
  const [q, setQ] = useState('');

  const mlas = p.reps.filter((r) => r.role === 'MLA');
  const unreachable = new Set(p.readiness.wardsUnreachable);
  const unverified = new Set(p.readiness.wardsUnverified);
  const noLoc = new Set(p.readiness.wardsNoLocation);
  const needs = (w: Ward) => unreachable.has(w.wardNumber) || unverified.has(w.wardNumber) || noLoc.has(w.wardNumber);
  const edited = (w: Ward) => !!p.edits[`ward:${w.wardNumber}`];
  const counts = { all: p.wards.length, attention: p.wards.filter(needs).length, edited: p.wards.filter(edited).length };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return p.wards.filter((w) => {
      if (filter === 'attention' && !needs(w)) return false;
      if (filter === 'edited' && !edited(w)) return false;
      if (!s) return true;
      return String(w.wardNumber) === s || [w.name, w.area, w.councillorName, w.councillorPhone].some((x) => x?.toLowerCase().includes(s));
    });
  }, [p.wards, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const wardFields: Field[] = [
    { name: 'councillorName', label: 'data.f.councillorName', kind: 'text' },
    { name: 'councillorPhone', label: 'data.f.councillorPhone', hint: 'data.f.councillorPhone.hint', kind: 'tel' },
    { name: 'councillorEmail', label: 'data.f.councillorEmail', hint: 'data.f.councillorEmail.hint', kind: 'email' },
    { name: 'zone', label: 'data.f.zone', kind: 'select', options: ZONES.map((z) => ({ value: z, label: t(`zone.${z}`) })) },
    { name: 'assembly', label: 'data.f.assembly', kind: 'select', options: mlas.map((m) => ({ value: m.slug, label: `${m.constituency} · ${m.name}` })) },
    { name: 'name', label: 'data.f.name', kind: 'text' },
    { name: 'area', label: 'data.f.area', kind: 'textarea' },
    { name: 'location', label: 'data.f.location', hint: 'data.f.location.hint', kind: 'location' },
    { name: 'verified', label: 'data.f.verified', hint: 'data.f.verified.hint', kind: 'bool' },
  ];
  const contactLine = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(' · ') || t('data.notSet');

  return (
    <div className="space-y-6">
      <ReadinessCard r={p.readiness} />

      <section className="space-y-2">
        <h2 className="text-xl">{t('data.esc.title')}</h2>
        <p className="text-sm text-muted">{t('data.esc.sub')}</p>
        {(['rmc', 'rcd', 'nh', 'forest'] as const).map((g) => (
          <div key={g} className="space-y-2">
            <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted">{t(`data.esc.group.${g}`)}</h3>
            <ul className="space-y-2">
                {p.escalation.filter((e) => groupOf(e.role) === g).map((e) => (
                  <Editable
                    key={e.role}
                    dataKey={`escalation:${e.role}`}
                    title={e.title}
                    initial={{ name: e.name, email: e.email, phone: e.phone, verified: e.verified }}
                    edit={p.edits[`escalation:${e.role}`]}
                    fields={[
                      { name: 'name', label: 'data.f.personName', kind: 'text' },
                      { name: 'email', label: 'data.f.email', kind: 'email' },
                      { name: 'phone', label: 'data.f.mobile', kind: 'tel' },
                      { name: 'verified', label: 'data.f.verified', hint: 'data.f.verified.hint', kind: 'bool' },
                    ]}
                    summary={
                      <>
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                          {e.title}
                          {e.verified ? <Badge tone="ok">{t('data.badge.checked')}</Badge> : <Badge tone="warn">{t('data.badge.unverified')}</Badge>}
                          {!e.email && !e.phone && <Badge tone="bad">{t('data.badge.unreachable')}</Badge>}
                          {p.edits[`escalation:${e.role}`] && <Badge tone="info">{t('data.badge.edited')}</Badge>}
                        </p>
                        <p className="text-sm text-muted">{contactLine(e.name, e.email, e.phone)}</p>
                      </>
                    }
                  />
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl">{t('data.wards.title')}</h2>
        <div className="flex flex-wrap gap-2" role="tablist">
          {(['attention', 'all', 'edited'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`chip ${filter === k ? 'chip-on' : ''}`}>
              {t(`data.wards.${k}`, { n: counts[k] })}
            </button>
          ))}
        </div>
        <input className="field" type="search" placeholder={t('data.wards.search')} aria-label={t('data.wards.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        {!shown.length && <p className="card p-4 text-sm text-muted">{t('data.wards.none')}</p>}
        <ul className="space-y-2">
          {shown.map((w) => {
            const key = `ward:${w.wardNumber}`;
            const mla = mlas.find((m) => m.slug === w.assembly);
            return (
              <Editable
                key={key}
                dataKey={key}
                title={t('ward.title', { n: w.wardNumber })}
                edit={p.edits[key]}
                initial={{
                  councillorName: w.councillorName,
                  councillorPhone: w.councillorPhone,
                  councillorEmail: w.councillorEmail ?? null,
                  zone: w.zone,
                  assembly: w.assembly ?? null,
                  name: w.name,
                  area: w.area ?? null,
                  lat: w.lat,
                  lng: w.lng,
                  verified: w.verified,
                }}
                fields={wardFields}
                summary={
                  <>
                    <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                      {t('ward.title', { n: w.wardNumber })}
                      {w.name && <span className="font-normal">· {w.name}</span>}
                      {unreachable.has(w.wardNumber) && <Badge tone="bad">{t('data.badge.unreachable')}</Badge>}
                      {unverified.has(w.wardNumber) && <Badge tone="warn">{t('data.badge.unverified')}</Badge>}
                      {noLoc.has(w.wardNumber) && <Badge tone="warn">{t('data.badge.noLocation')}</Badge>}
                      {edited(w) && <Badge tone="info">{t('data.badge.edited')}</Badge>}
                    </p>
                    <p className="text-sm">{contactLine(w.councillorName, w.councillorPhone, w.councillorEmail)}</p>
                    <p className="text-xs text-muted">{[w.zone && t(`zone.${w.zone}`), mla && `MLA: ${mla.constituency}`].filter(Boolean).join(' · ')}</p>
                  </>
                }
              />
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl">{t('data.people.title')}</h2>
        <ul className="space-y-2">
          {p.officials.map((o) => (
            <Editable
              key={o.role}
              dataKey={`official:${o.role}`}
              title={o.title}
              edit={p.edits[`official:${o.role}`]}
              initial={{ name: o.name, phone: o.phone, verified: o.verified }}
              fields={[
                { name: 'name', label: 'data.f.personName', kind: 'text' },
                { name: 'phone', label: 'data.f.phone', kind: 'tel' },
                { name: 'verified', label: 'data.f.verified', kind: 'bool' },
              ]}
              summary={
                <>
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {o.title}
                    {!o.verified && <Badge tone="warn">{t('data.badge.unverified')}</Badge>}
                    {p.edits[`official:${o.role}`] && <Badge tone="info">{t('data.badge.edited')}</Badge>}
                  </p>
                  <p className="text-sm text-muted">{contactLine(o.name, o.phone)}</p>
                </>
              }
            />
          ))}
          {p.reps.filter((r) => r.role !== 'Mayor').map((r) => (
            <Editable
              key={r.slug}
              dataKey={`rep:${r.slug}`}
              title={r.name}
              edit={p.edits[`rep:${r.slug}`]}
              initial={{ name: r.name, party: r.party, phone: r.phone }}
              fields={[
                { name: 'name', label: 'data.f.personName', kind: 'text' },
                { name: 'party', label: 'data.f.party', kind: 'text' },
                { name: 'phone', label: 'data.f.phone', kind: 'tel' },
              ]}
              summary={
                <>
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {r.role} · {r.constituency}
                    {p.edits[`rep:${r.slug}`] && <Badge tone="info">{t('data.badge.edited')}</Badge>}
                  </p>
                  <p className="text-sm text-muted">{contactLine(r.name, r.party, r.phone)}</p>
                </>
              }
            />
          ))}
          {p.assemblyVerified !== null && (
            <Editable
              dataKey="meta:assembly"
              title={t('data.people.assembly')}
              edit={p.edits['meta:assembly']}
              initial={{ verified: p.assemblyVerified }}
              fields={[{ name: 'verified', label: 'data.people.assembly', hint: 'data.people.assemblyHint', kind: 'bool' }]}
              summary={
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                  {t('data.people.assembly')}
                  {p.assemblyVerified ? <Badge tone="ok">{t('data.badge.checked')}</Badge> : <Badge tone="warn">{t('data.badge.unverified')}</Badge>}
                </p>
              }
            />
          )}
          <Editable
            dataKey="meta:helpline"
            title={t('data.helpline')}
            edit={p.edits['meta:helpline']}
            initial={{ phone: p.helpline.phone, email: p.helpline.email }}
            fields={[
              { name: 'phone', label: 'data.f.phone', kind: 'tel' },
              { name: 'email', label: 'data.f.email', kind: 'email' },
            ]}
            summary={
              <>
                <p className="text-sm font-semibold">{t('data.helpline')}</p>
                <p className="text-sm text-muted">{contactLine(p.helpline.phone, p.helpline.email)}</p>
              </>
            }
          />
        </ul>
      </section>

      <section className="card space-y-2 p-4">
        <a href="/api/admin/data/export" className="btn-ghost w-full" download>
          {t('data.download')}
        </a>
        <p className="text-xs text-muted">{t('data.downloadHint')}</p>
      </section>
    </div>
  );
}

/** Which office's list an escalation contact belongs under. */
const groupOf = (role: string) =>
  role.startsWith('rcd_') ? 'rcd' : role.startsWith('nh_') ? 'nh' : role === 'dfo' || role === 'cf' || role === 'pccf' ? 'forest' : 'rmc';
