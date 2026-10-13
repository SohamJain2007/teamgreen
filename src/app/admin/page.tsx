import type { Metadata } from 'next';
import AdminPanel, { AdminLogin, AdminMustChange } from '@/components/AdminPanel';
import { currentAdmin } from '@/lib/auth';
import { adminEnabled, lastActionByReport, listAdmins, listAudit } from '@/lib/admins';
import { listAll } from '@/lib/reports';
import { VERIFY_CONFIRMATIONS } from '@/lib/constants';
import { dispatchPending, listNotifications, notifyMode } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const me = await currentAdmin();
  if (!me) return <AdminLogin disabled={!adminEnabled()} />;
  if (me.mustChange) return <AdminMustChange me={me} />;
  void dispatchPending(); // pick up anything queued while the server was idle
  const deliveries: Record<string, { channel: string; status: string; error: string | null }[]> = {};
  for (const n of listNotifications()) (deliveries[n.report_id] ??= []).push({ channel: [n.kind === 'complaint' ? null : n.kind, n.role, n.channel].filter(Boolean).join(' '), status: n.status, error: n.error });
  return (
    <AdminPanel
      me={me}
      reports={listAll()}
      deliveries={deliveries}
      mode={notifyMode()}
      needed={VERIFY_CONFIRMATIONS}
      admins={me.role === 'owner' ? listAdmins() : []}
      activity={listAudit()}
      lastActions={lastActionByReport()}
    />
  );
}
