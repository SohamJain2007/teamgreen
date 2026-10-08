import type { Metadata, Viewport } from 'next';
import { Mukta, Rozha_One } from 'next/font/google';
import './globals.css';
import { getLang } from '@/lib/lang-server';
import { translate } from '@/lib/translations';
import { LangProvider } from '@/components/I18n';
import { BottomNav, Header } from '@/components/Nav';
import SWRegister from '@/components/SWRegister';

// Mukta: friendly Devanagari + Latin text face. Rozha One: bold Devanagari + Latin headline face with a
// printed, notice-board feel.
const body = Mukta({ subsets: ['latin', 'devanagari'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const display = Rozha_One({ subsets: ['latin', 'devanagari'], weight: '400', variable: '--font-display', display: 'swap' });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'SafaiRanchi: report garbage spots in Ranchi', template: '%s · SafaiRanchi' },
  description: 'Report garbage black spots in Ranchi in 30 seconds and track them publicly until they are cleared.',
  applicationName: 'SafaiRanchi',
  appleWebApp: { capable: true, title: 'SafaiRanchi', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#B5361E', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen pb-24 md:pb-0">
        <LangProvider lang={lang}>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 pb-8 pt-2 text-xs text-muted">
            <p>{translate(lang, 'disclaimer')}</p>
            <p className="mt-1">© OpenStreetMap contributors</p>
          </footer>
          <BottomNav />
          <SWRegister />
        </LangProvider>
      </body>
    </html>
  );
}
