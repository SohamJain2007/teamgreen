import type { Metadata, Viewport } from 'next';
import { Mukta, Poppins } from 'next/font/google';
import './globals.css';
import { getLang } from '@/lib/lang-server';
import { translate } from '@/lib/translations';
import { LangProvider } from '@/components/I18n';
import { BottomNav, Header } from '@/components/Nav';
import SWRegister from '@/components/SWRegister';
import { SohraiBand } from '@/components/Ranchi';

// Mukta: friendly Devanagari + Latin text face. Poppins: clean geometric headline face that also covers Devanagari.
const body = Mukta({ subsets: ['latin', 'devanagari'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const display = Poppins({ subsets: ['latin', 'devanagari'], weight: ['600', '700'], variable: '--font-display', display: 'swap' });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'SafaiRanchi: report garbage spots in Ranchi', template: '%s · SafaiRanchi' },
  description: 'Report garbage black spots in Ranchi in 30 seconds and track them publicly until they are cleared.',
  applicationName: 'SafaiRanchi',
  appleWebApp: { capable: true, title: 'SafaiRanchi', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#1A7A50', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen pb-24 md:pb-0">
        <LangProvider lang={lang}>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
          <footer className="mt-6 border-t border-line bg-white">
            <SohraiBand className="block h-1.5" />
            <div className="mx-auto max-w-5xl px-4 pb-8 pt-5 text-xs text-muted">
              <p className="font-display text-sm text-sal-dark">{translate(lang, 'footer.made')}</p>
              <p className="mt-2">{translate(lang, 'disclaimer')}</p>
              <p className="mt-1">© OpenStreetMap contributors</p>
            </div>
          </footer>
          <BottomNav />
          <SWRegister />
        </LangProvider>
      </body>
    </html>
  );
}
