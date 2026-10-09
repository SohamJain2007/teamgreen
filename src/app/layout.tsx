import type { Metadata, Viewport } from 'next';
import { Mukta, Poppins } from 'next/font/google';
import './globals.css';
import { getLang } from '@/lib/lang-server';
import { translate } from '@/lib/translations';
import { LangProvider } from '@/components/I18n';
import { BottomNav, Header } from '@/components/Nav';
import SWRegister from '@/components/SWRegister';
import Link from 'next/link';
import Image from 'next/image';
import { SohraiBand } from '@/components/Ranchi';
import { LogoMark } from '@/components/Logo';
import { getWardFile } from '@/lib/wards';

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
  const helpline = getWardFile().meta.rmcHelpline.phone;
  return (
    <html lang={lang} className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen pb-24 md:pb-0">
        <LangProvider lang={lang}>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
          <footer className="mt-12 border-t border-line bg-white">
            <SohraiBand className="block h-1.5" />
            <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-8 pt-8 text-sm md:grid-cols-[2fr_1fr_1fr]">
              <div>
                <Link href="/" className="inline-flex items-center gap-2">
                  <LogoMark size={28} />
                  <span className="font-display text-lg text-sal-dark">{translate(lang, 'app.name')}</span>
                </Link>
                <p className="mt-2 font-display text-sal-dark">{translate(lang, 'footer.made')}</p>
                <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted">
                  {translate(lang, 'initiative.by')}
                  <Image src="/team-green.png" alt="Team G.R.E.E.N." width={294} height={160} className="h-10 w-auto" />
                </p>
                <p className="mt-2 max-w-md text-xs text-muted">{translate(lang, 'disclaimer')}</p>
              </div>
              <nav>
                <p className="font-semibold text-ink">{translate(lang, 'footer.explore')}</p>
                <ul className="mt-2 space-y-1.5 text-muted">
                  {(['report', 'map', 'leaderboard'] as const).map((r) => (
                    <li key={r}>
                      <Link href={`/${r}`} className="hover:text-sal-dark">
                        {translate(lang, r === 'report' ? 'nav.report' : r === 'map' ? 'nav.map' : 'nav.rankings')}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div>
                <p className="font-semibold text-ink">{translate(lang, 'footer.help')}</p>
                <ul className="mt-2 space-y-1.5 text-muted">
                  <li>
                    {translate(lang, 'footer.helpline')}:{' '}
                    <a href={`tel:${helpline}`} className="font-semibold text-sal-dark hover:underline">{helpline}</a>
                  </li>
                  <li><Link href="/credits" className="hover:text-sal-dark">{translate(lang, 'footer.credits')}</Link></li>
                </ul>
              </div>
            </div>
            <p className="border-t border-line py-3 text-center text-xs text-muted">© OpenStreetMap contributors</p>
          </footer>
          <BottomNav />
          <SWRegister />
        </LangProvider>
      </body>
    </html>
  );
}
