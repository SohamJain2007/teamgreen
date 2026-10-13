'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { normEmail, normPhone } from '@/lib/contact';
import { useRouter } from 'next/navigation';
import { useI18n } from './I18n';
import LocationPicker from './LocationPicker';
import { photoUrl } from '@/lib/format';
import { CATEGORIES, type Category, type Status } from '@/lib/constants';
import { StatusBadge } from './ui';
import { compress } from '@/lib/client-media';
import { distanceFromRanchiM, inRanchi } from '@/lib/geo';
import Link from 'next/link';

type WardOpt = { n: number; name: string | null; zone: string | null };
type Loc = { lat: number; lng: number; accuracy: number | null; source: 'gps' | 'pin' };
type Fix = { lat: number; lng: number; accuracy: number | null };
type LocState = 'loading' | 'ok' | 'denied' | 'error' | 'outside';
type Nearby = { id: string; thumb: string; category: Category | null; status: Status; upvotes: number; distanceM: number };
type WardRes = { ward: number | null; method: 'polygon' | 'centroid' | 'none' };

export default function ReportFlow({ wards }: { wards: WardOpt[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const honeyRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null); // the spot: GPS, or a pin the person moved
  const [me, setMe] = useState<Fix | null>(null); // where the phone is; must be in Ranchi to report
  const [locState, setLocState] = useState<LocState>('loading');
  const [awayKm, setAwayKm] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [wardRes, setWardRes] = useState<WardRes | null>(null);
  const [wardChoice, setWardChoice] = useState<number | null>(null); // manual override
  const [editWard, setEditWard] = useState(false);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [dupDismissed, setDupDismissed] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ask for GPS straight away: it shows at once whether the person is in Ranchi, and is ready by the time the photo is taken.
  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) return setLocState('error');
    setLocState('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng, accuracy } = p.coords;
        if (!inRanchi(lat, lng, accuracy)) {
          setAwayKm(Math.round(distanceFromRanchiM(lat, lng) / 1000));
          return setLocState('outside');
        }
        setMe({ lat, lng, accuracy });
        setLoc({ lat, lng, accuracy, source: 'gps' });
        setLocState('ok');
      },
      (e) => setLocState(e.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);
  useEffect(locate, [locate]);

  // Ward + duplicate lookup whenever the location changes.
  useEffect(() => {
    if (!loc) return;
    const ac = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}`, { signal: ac.signal });
        if (!r.ok) return;
        const d = await r.json();
        setWardRes(d.ward);
        setNearby(d.nearby);
        setDupDismissed(false);
      } catch {}
    }, 250);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [loc?.lat, loc?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onFile = useCallback(async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    const quick = URL.createObjectURL(f);
    setPreview(quick);
    setPhoto(f);
    const small = await compress(f);
    setPhoto(small);
  }, []);

  const ward = wardChoice ?? wardRes?.ward ?? null;
  const approx = wardChoice == null && wardRes?.method === 'centroid';

  async function submit() {
    if (!photo) return setError(t('report.err.photo'));
    if (!loc || !me) return setError(t('report.err.loc'));
    if (phone.trim() && !normPhone(phone)) return setError(t('report.err.phone'));
    if (email.trim() && !normEmail(email)) return setError(t('report.err.email'));
    if (!phone.trim() && !email.trim()) return setError(t('report.err.contact'));
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('photo', photo, 'photo.jpg');
    fd.append('lat', String(loc.lat));
    fd.append('lng', String(loc.lng));
    if (loc.accuracy) fd.append('accuracy', String(loc.accuracy));
    fd.append('locSource', loc.source);
    fd.append('meLat', String(me.lat));
    fd.append('meLng', String(me.lng));
    if (me.accuracy) fd.append('meAccuracy', String(me.accuracy));
    if (ward) fd.append('ward', String(ward));
    if (category) fd.append('category', category);
    if (note.trim()) fd.append('note', note.trim());
    if (phone.trim()) fd.append('phone', phone.trim());
    if (email.trim()) fd.append('email', email.trim());
    fd.append('website', honeyRef.current?.value ?? '');
    try {
      const r = await fetch('/api/reports', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.id) return router.push(`/r/${d.id}?new=1`);
      if (d.error === 'not_in_ranchi') {
        setAwayKm(Number(d.km) || 0);
        setLocState('outside');
        setBusy(false);
        return;
      }
      setError(
        r.status === 429
          ? t('report.err.rate')
          : d.error === 'outside' ? t('report.err.outside')
          : d.error === 'loc' || d.error === 'need_location' ? t('report.err.loc')
          : d.error === 'phone' ? t('report.err.phone')
          : d.error === 'email' ? t('report.err.email')
          : d.error === 'contact' ? t('report.err.contact')
          : t('report.err.generic'),
      );
    } catch {
      setError(t('report.err.generic'));
    }
    setBusy(false);
  }

  async function addVoice(id: string) {
    setBusy(true);
    try {
      // The reporter is standing at the spot, so their location confirms it.
      await fetch(`/api/reports/${id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: loc?.lat, lng: loc?.lng }),
      });
    } catch {}
    router.push(`/r/${id}?voted=1`);
  }

  const hiddenInputs = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </>
  );

  // ---------- Not in Ranchi, or no location: nothing to report with ----------
  if (locState === 'outside' || locState === 'denied' || locState === 'error') {
    const outside = locState === 'outside';
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="card space-y-3 p-5 text-center" role="alert">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-palash-soft text-palash-dark">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
          </div>
          <h1 className="text-2xl">{t(outside ? 'report.outside.title' : 'report.needLoc.title')}</h1>
          <p>{outside ? t('report.outside.body', { km: awayKm.toLocaleString('en-IN') }) : t('report.needLoc.body')}</p>
          {locState === 'denied' && <p className="text-sm font-semibold text-palash-dark">{t('report.needLoc.denied')}</p>}
          {outside && <p className="text-sm text-muted">{t('report.outside.hint')}</p>}
        </div>
        <button onClick={locate} className="btn-primary w-full">
          {t(outside ? 'report.outside.retry' : 'report.needLoc.retry')}
        </button>
        <Link href="/map" className="btn-ghost w-full">
          {t('report.outside.map')}
        </Link>
      </div>
    );
  }

  // ---------- Step 1: photo ----------
  if (!preview) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-3xl">{t('report.title')}</h1>
        <p className="text-muted">{t('report.lead')}</p>
        {hiddenInputs}
        <button onClick={() => camRef.current?.click()} className="grid aspect-[4/3] w-full place-items-center rounded-3xl border-2 border-dashed border-sal/50 bg-gradient-to-b from-sal-soft to-jharna-soft text-sal-dark transition hover:border-sal active:scale-[.99]">
          <span className="flex flex-col items-center gap-2">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
              <circle cx="12" cy="13.5" r="3.5" />
            </svg>
            <span className="text-xl font-bold">{t('report.takePhoto')}</span>
          </span>
        </button>
        <button onClick={() => galRef.current?.click()} className="btn-ghost w-full">
          {t('report.fromGallery')}
        </button>
        <LocStatus />
        <p className="text-xs text-muted">{t('report.privacy')}</p>
      </div>
    );
  }

  function LocStatus() {
    const msg =
      locState === 'loading'
        ? t('report.locating')
        : loc?.source === 'pin'
          ? t('report.locPinned')
          : t('report.locked', { m: Math.round(loc?.accuracy ?? 0) });
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${locState === 'ok' ? 'bg-sal' : 'animate-pulse bg-haldi'}`} />
        <span className="font-medium">{msg}</span>
      </div>
    );
  }

  const canSubmit = !!photo && !!loc && !!me && !busy;
  const wardObj = wards.find((w) => w.n === ward);
  const dup = !dupDismissed && nearby.length > 0 ? nearby[0] : null;

  // ---------- Step 2: confirm + send ----------
  return (
    <div className="mx-auto max-w-md space-y-4">
      {hiddenInputs}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="max-h-72 w-full rounded-2xl bg-line object-cover" />
        <button onClick={() => camRef.current?.click()} className="absolute bottom-2 right-2 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white">
          {t('report.retake')}
        </button>
      </div>

      <div className="card space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <LocStatus />
          {loc && (
            <button onClick={() => setShowMap((v) => !v)} className="text-sm font-semibold text-jharna-dark underline">
              {t('report.adjust')}
            </button>
          )}
        </div>
        {showMap && loc && (
          <>
            <p className="text-xs text-muted">{t('report.pinHint')}</p>
            <LocationPicker
              value={loc}
              onChange={(lat, lng) => setLoc({ lat, lng, accuracy: null, source: 'pin' })}
            />
          </>
        )}
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="text-muted">{t('report.ward')}:</span>
          {editWard || (!ward && loc) ? (
            <select
              className="field !min-h-[40px] max-w-[14rem] !py-1.5"
              value={ward ?? ''}
              onChange={(e) => {
                setWardChoice(e.target.value ? Number(e.target.value) : null);
                setEditWard(false);
              }}
              aria-label={t('report.ward')}
            >
              <option value="">{t('report.wardUnknown')}</option>
              {wards.map((w) => (
                <option key={w.n} value={w.n}>
                  {w.n}{w.name ? ` · ${w.name}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <>
              <strong>{ward ? `${ward}${wardObj?.name ? ` · ${wardObj.name}` : ''}` : '—'}</strong>
              {ward && wardChoice == null && <span className="text-xs text-muted">({approx ? t('report.wardApprox') : t('report.wardAuto')})</span>}
              {loc && (
                <button onClick={() => setEditWard(true)} className="font-semibold text-jharna-dark underline">
                  {t('report.wardChange')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {dup && (
        <div className="rounded-2xl border-2 border-haldi bg-haldi-soft p-3" role="alert">
          <p className="font-bold text-haldi-text">{t('report.dup.title')}</p>
          <div className="mt-2 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(dup.thumb)} alt="" className="h-20 w-20 rounded-xl object-cover" />
            <div className="text-sm">
              <StatusBadge status={dup.status} />
              <p className="mt-1">
                {dup.category ? t(`cat.${dup.category}`) : t('r.title')} · {t('report.dup.away', { m: dup.distanceM })}
              </p>
              <p className="text-muted">{t('r.people', { n: dup.upvotes })}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => addVoice(dup.id)} disabled={busy} className="btn-primary !min-h-[44px] !py-2">
              {t('report.dup.add')}
            </button>
            <button onClick={() => setDupDismissed(true)} className="btn-ghost !min-h-[44px] !py-2">
              {t('report.dup.new')}
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-semibold">
          {t('report.category')} <span className="font-normal text-muted">({t('report.optional')})</span>
        </p>
        <div className="flex flex-wrap gap-2" role="group">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(category === c ? null : c)} aria-pressed={category === c} className={`chip ${category === c ? 'chip-on' : ''}`}>
              {t(`cat.${c}`)}
            </button>
          ))}
        </div>
      </div>

      {showNote ? (
        <label className="block text-sm font-semibold">
          {t('report.note')} <span className="font-normal text-muted">({t('report.optional')})</span>
          <textarea className="field mt-1 font-normal" rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('report.notePlaceholder')} />
        </label>
      ) : (
        <button onClick={() => setShowNote(true)} className="text-sm font-semibold text-jharna-dark underline">
          + {t('report.note')} ({t('report.optional')})
        </button>
      )}

      <fieldset className="card space-y-3 p-4">
        <legend className="sr-only">{t('report.contact.title')}</legend>
        <div>
          <p className="text-sm font-semibold">{t('report.contact.title')}</p>
          <p className="text-xs text-muted">{t('report.contact.hint')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            {t('report.phone')}
            <input className="field mt-1 font-normal" type="tel" inputMode="tel" autoComplete="tel" maxLength={16} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
          </label>
          <label className="block text-sm font-semibold">
            {t('report.email')}
            <input className="field mt-1 font-normal" type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
        </div>
      </fieldset>

      {/* Honeypot: invisible to people, tempting to bots */}
      <input ref={honeyRef} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      {error && <p className="rounded-xl bg-palash-soft p-3 text-sm font-semibold text-palash-dark" role="alert">{error}</p>}

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <button onClick={submit} disabled={!canSubmit} className="btn-primary w-full text-lg shadow-lg">
          {busy ? t('report.submitting') : !loc ? t('report.locating') : t('report.submit')}
        </button>
      </div>
      <p className="text-xs text-muted">{t('report.privacy')}</p>
    </div>
  );
}
