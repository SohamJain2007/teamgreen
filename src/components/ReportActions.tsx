'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './I18n';
import { compress, getPosition } from '@/lib/client-media';
import type { Status } from '@/lib/constants';

type Props = {
  id: string;
  upvotes: number;
  status: Status;
  verified: boolean;
  needed: number;
  radiusM: number;
  reopenThreshold: number;
  /** Pre-rendered "Reported 172d ago · Seen by 1 person · 172d unresolved" line for the bottom bar. */
  summary: string;
};

export default function ReportActions(p: Props) {
  const t = useT();
  const router = useRouter();
  const [upvotes, setUpvotes] = useState(p.upvotes);
  const [voted, setVoted] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [dirtyVoted, setDirtyVoted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // bar: shown in the sticky action bar (next to the button that was tapped) instead of at the top of the section.
  const [msg, setMsg] = useState<{ ok: boolean; text: string; bar?: boolean } | null>(null);
  const cleanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setVoted(localStorage.getItem(`sr-up-${p.id}`) === '1');
      setFlagged(localStorage.getItem(`sr-spam-${p.id}`) === '1');
      setDirtyVoted(localStorage.getItem(`sr-dirty-${p.id}`) === '1');
    } catch {}
  }, [p.id]);

  const remember = (k: string) => {
    try { localStorage.setItem(`sr-${k}-${p.id}`, '1'); } catch {}
  };

  async function locate(bar = false) {
    setMsg({ ok: true, text: t('r.locating'), bar });
    const pos = await getPosition();
    if (!pos) setMsg({ ok: false, text: t('r.noLoc'), bar });
    return pos;
  }
  const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
  const errText = (d: { error?: string; distanceM?: number | null }, status: number) =>
    d.error === 'too_far'
      ? d.distanceM != null ? t('r.tooFarDist', { d: fmtDist(d.distanceM), m: p.radiusM }) : t('r.tooFar', { m: p.radiusM })
      : status === 429 ? t('report.err.rate') : t('r.err');

  async function postJson(path: string, pos: { lat: number; lng: number }) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pos) }).catch(() => null);
    return { r, d: r ? await r.json().catch(() => ({})) : {} };
  }

  async function confirm() {
    if (voted || busy) return;
    setBusy('up');
    const pos = await locate();
    if (pos) {
      const { r, d } = await postJson(`/api/reports/${p.id}/upvote`, pos);
      if (r?.ok) {
        setUpvotes(d.upvotes);
        setVoted(true);
        remember('up');
        setMsg({ ok: true, text: d.verified && !p.verified ? t('r.verifiedNow') : t('r.upped') });
        router.refresh();
      } else setMsg({ ok: false, text: errText(d, r?.status ?? 0) });
    }
    setBusy(null);
  }

  async function markClean(file: File | undefined) {
    if (!file) return;
    setBusy('clean');
    const pos = await locate(true);
    if (pos) {
      const fd = new FormData();
      fd.append('photo', await compress(file), 'after.jpg');
      fd.append('lat', String(pos.lat));
      fd.append('lng', String(pos.lng));
      const r = await fetch(`/api/reports/${p.id}/clean`, { method: 'POST', body: fd }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) {
        setMsg({ ok: true, text: t('r.clean.done'), bar: true });
        router.refresh();
      } else setMsg({ ok: false, text: errText(d, r?.status ?? 0), bar: true });
    }
    if (cleanRef.current) cleanRef.current.value = '';
    setBusy(null);
  }

  async function stillDirty() {
    if (dirtyVoted || busy) return;
    setBusy('dirty');
    const pos = await locate(true);
    if (pos) {
      const { r, d } = await postJson(`/api/reports/${p.id}/still-dirty`, pos);
      if (r?.ok) {
        setDirtyVoted(true);
        remember('dirty');
        setMsg({ ok: true, text: d.reopened ? t('r.dirty.reopened') : t('r.dirty.thanks', { n: p.reopenThreshold }), bar: true });
        router.refresh();
      } else setMsg({ ok: false, text: errText(d, r?.status ?? 0), bar: true });
    }
    setBusy(null);
  }

  async function flag() {
    if (flagged) return;
    await fetch(`/api/reports/${p.id}/spam`, { method: 'POST' }).catch(() => null);
    setFlagged(true);
    remember('spam');
    setMsg({ ok: true, text: t('r.spamThanks'), bar: true });
  }

  const confirmations = Math.max(0, upvotes - 1);
  const cleared = p.status === 'cleared';

  return (
    <>
      {msg && !msg.bar && <Msg ok={msg.ok} text={msg.text} />}

      {!cleared && (
        <section className="card space-y-3 p-4">
          {p.verified ? (
            <p className="flex items-center gap-2 font-semibold text-sal-dark">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-sal text-xs text-white" aria-hidden="true">✓</span>
              {t('r.verified')} · {t('r.people', { n: upvotes })}
            </p>
          ) : (
            <div>
              <p className="font-semibold">{t('r.confirmProgress', { n: Math.min(confirmations, p.needed), m: p.needed })}</p>
              <div className="mt-2 flex gap-1.5" aria-hidden="true">
                {Array.from({ length: p.needed }, (_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded-full ${i < confirmations ? 'bg-sal' : 'bg-line'}`} />
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">{t('r.confirmHint', { m: p.radiusM })}</p>
            </div>
          )}
          <button onClick={confirm} disabled={voted || busy != null} className="btn-primary">
            {busy === 'up' ? t('r.locating') : voted ? t('r.upped') : t('r.up')}
          </button>
        </section>
      )}

      {/* Sticky action bar, above the mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[900] border-t border-line bg-white/95 px-3 pb-3 pt-2 backdrop-blur md:bottom-0">
        <div className="mx-auto max-w-2xl">
          {msg?.bar ? <div className="mb-2"><Msg ok={msg.ok} text={msg.text} /></div> : <p className="mb-2 text-center text-xs text-muted" suppressHydrationWarning>{p.summary}</p>}
          <input ref={cleanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => markClean(e.target.files?.[0])} />
          <div className="grid grid-cols-2 gap-2">
            {cleared ? (
              <button onClick={stillDirty} disabled={dirtyVoted || busy != null} className="btn bg-palash text-white hover:bg-palash-dark">
                {busy === 'dirty' ? t('r.locating') : dirtyVoted ? t('r.dirty.voted') : t('r.dirty.btn')}
              </button>
            ) : (
              <button onClick={() => cleanRef.current?.click()} disabled={busy != null} className="btn bg-sal text-white hover:bg-sal-dark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.8 2.8L16 10" /></svg>
                {busy === 'clean' ? t('r.locating') : t('btn.verifyCleanup')}
              </button>
            )}
            <button onClick={flag} disabled={flagged} className="btn bg-[#7C3AED] text-white hover:bg-[#6D28D9]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
              {flagged ? t('btn.flagged') : t('btn.flag')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Msg({ ok, text }: { ok: boolean; text: string }) {
  return <p role="status" className={`rounded-xl p-3 text-sm font-semibold ${ok ? 'bg-sal-soft text-sal-dark' : 'bg-palash-soft text-palash-dark'}`}>{text}</p>;
}
