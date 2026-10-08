'use client';
import { useI18n } from './I18n';

export default function LangToggle() {
  const { lang, t, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
      className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-paper"
      aria-label="Switch language / भाषा बदलें"
    >
      {t('lang.switch')}
    </button>
  );
}
