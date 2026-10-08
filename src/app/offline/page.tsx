import { getT } from '@/lib/lang-server';

export default async function Offline() {
  const { t } = await getT();
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl">{t('offline.title')}</h1>
      <p className="mt-2 text-muted">{t('offline.body')}</p>
    </div>
  );
}
