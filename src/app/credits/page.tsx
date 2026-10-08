import Image from 'next/image';
import type { Metadata } from 'next';
import { getT } from '@/lib/lang-server';
import { PHOTOS } from '@/lib/photos';

export const metadata: Metadata = { title: 'Photo credits' };

export default async function Credits() {
  const { t } = await getT();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">{t('credits.title')}</h1>
      <p className="max-w-2xl text-muted">{t('credits.lead')}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {Object.values(PHOTOS).map((ph) => (
          <li key={ph.slug} className="card flex gap-3 overflow-hidden p-2">
            <Image src={ph.src} alt={t(ph.place)} width={128} height={96} className="h-24 w-32 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 py-0.5 text-sm">
              <p className="font-display text-base">{t(ph.place)}</p>
              <p className="text-muted">{ph.artist}</p>
              <p>
                <a href={ph.licenseUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-jharna-dark underline">{ph.license}</a>
                {' · '}
                <a href={ph.page} target="_blank" rel="noopener noreferrer" className="font-semibold text-jharna-dark underline">{t('credits.view')}</a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
