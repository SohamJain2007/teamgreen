'use client';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, translate, type Key, type Lang } from '@/lib/translations';

type Ctx = { lang: Lang; t: (k: Key, vars?: Record<string, string | number>) => string; setLang: (l: Lang) => void };
const C = createContext<Ctx>({ lang: 'en', t: (k) => k, setLang: () => {} });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );
  const value = useMemo<Ctx>(() => ({ lang, t: (k, v) => translate(lang, k, v), setLang }), [lang, setLang]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useI18n = () => useContext(C);
export const useT = () => useContext(C).t;
