import Link from 'next/link';
import { getT } from '@/lib/lang-server';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl">{t('notFound')}</h1>
      <Link href="/" className="btn-primary mt-4">{t('home.go')}</Link>
    </div>
  );
}
