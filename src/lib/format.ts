import type { Lang } from './translations';

export const locale = (lang: Lang) => (lang === 'hi' ? 'hi-IN' : 'en-IN');

export function fmtDate(ms: number, lang: Lang, withTime = true): string {
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'Asia/Kolkata',
  }).format(new Date(ms));
}

export function fmtAgo(ms: number, lang: Lang, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  const diff = ms - now;
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  const hrs = Math.round(diff / 3_600_000);
  if (Math.abs(hrs) < 24) return rtf.format(hrs, 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

export const daysBetween = (a: number, b: number) => Math.max(0, Math.round((b - a) / 86_400_000));
export const fmtNum = (n: number | null, digits = 1) => (n == null ? '—' : n.toFixed(digits).replace(/\.0$/, ''));

/** Public URL for a stored photo key. Matches LocalStorage.url(); change here if photos move to a CDN. */
export const photoUrl = (key: string) => `/uploads/${key}`;
