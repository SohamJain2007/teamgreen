import type { Metadata } from 'next';
import AdminPanel, { AdminLogin } from '@/components/AdminPanel';
import { adminPassword, isAdmin } from '@/lib/auth';
import { listAll } from '@/lib/reports';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin disabled={!adminPassword()} />;
  return <AdminPanel reports={listAll()} />;
}
