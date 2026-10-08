'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from './I18n';
import { LogoMark } from './Logo';
import LangToggle from './LangToggle';
import { SohraiBand } from './Ranchi';
import type { Key } from '@/lib/translations';

const LINKS: { href: string; key: Key; icon: string }[] = [
  { href: '/', key: 'nav.home', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { href: '/map', key: 'nav.map', icon: 'M9 3L3 5v16l6-2 6 2 6-2V3l-6 2zM9 3v16M15 5v16' },
  { href: '/report', key: 'nav.report', icon: 'M12 5v14M5 12h14' },
  { href: '/leaderboard', key: 'nav.rankings', icon: 'M5 21V11M12 21V4M19 21v-7' },
];

/** Two-tone wordmark: "Safai" in sal green, "Ranchi" in jharna teal (works for "SafaiRanchi" and "सफ़ाई रांची"). */
function BrandName({ name }: { name: string }) {
  const sp = name.indexOf(' ');
  const cut = sp > 0 ? sp : name.search(/Ranchi$/);
  const [a, b] = cut > 0 ? [name.slice(0, cut), name.slice(cut)] : [name, ''];
  return (
    <span className="font-display text-xl leading-none">
      <span className="text-sal-dark">{a}</span>
      <span className="text-jharna">{b}</span>
    </span>
  );
}

const active = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function Header() {
  const t = useT();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-white/90 backdrop-blur">
      <SohraiBand className="block h-1.5" />
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={32} />
          <BrandName name={t('app.name')} />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.filter((l) => l.href !== '/report').map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${active(path, l.href) ? 'bg-sal-soft text-sal-dark' : 'text-muted hover:bg-sal-soft/50 hover:text-ink'}`}
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/report" className="btn-primary hidden !min-h-[40px] !py-2 md:inline-flex">
            {t('home.cta')}
          </Link>
          <LangToggle />
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const t = useT();
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {LINKS.map((l) => {
          const isReport = l.href === '/report';
          const on = active(path, l.href);
          return (
            <li key={l.href}>
              <Link href={l.href} className="flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold" aria-current={on ? 'page' : undefined}>
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full ${
                    isReport ? 'bg-sal text-white shadow-md' : on ? 'bg-sal-soft text-sal-dark' : 'text-muted'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={l.icon} />
                  </svg>
                </span>
                {t(l.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
