import { cookies } from 'next/headers';
import { LANG_COOKIE, translate, type Key, type Lang } from './translations';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === 'hi' ? 'hi' : 'en';
}
export async function getT() {
  const lang = await getLang();
  return { lang, t: (k: Key, vars?: Record<string, string | number>) => translate(lang, k, vars) };
}
