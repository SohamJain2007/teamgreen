import type { Metadata } from 'next';
import AdminPanel, { AdminLogin } from '@/components/AdminPanel';
import { adminPassword, isAdmin } from '@/lib/auth';
import { listAll } from '@/lib/reports';
import { VERIFY_CONFIRMATIONS } from '@/lib/constants';
import { dispatchPending, listNotifications, notifyMode } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin disabled={!adminPassword()} />;
  void dispatchPending(); // pick up anything queued while the server was idle
  const deliveries: Record<string, { channel: string; status: string; error: string | null }[]> = {};
  for (const n of listNotifications()) (deliveries[n.report_id] ??= []).push({ channel: [n.kind === 'complaint' ? null : n.kind, n.role, n.channel].filter(Boolean).join(' '), status: n.status, error: n.error });
  return <AdminPanel reports={listAll()} deliveries={deliveries} mode={notifyMode()} needed={VERIFY_CONFIRMATIONS} />;
}
