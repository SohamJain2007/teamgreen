import { json, fail } from '@/lib/api';
import { audit, createAdmin, getAdmin, listAdmins, setPassword, updateAdmin, type Role } from '@/lib/admins';
import { requireOwner } from '@/lib/auth';

export const runtime = 'nodejs';

const role = (v: unknown): Role => (v === 'owner' ? 'owner' : 'staff');

/** Owners only: add people, set a temporary password, change role, deactivate / reactivate. Accounts are never deleted (audit). */
export async function POST(req: Request) {
  const me = await requireOwner();
  if (!me) return fail('unauthorized', 401);
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const target = Number.isInteger(id) ? getAdmin(id) : null;

  switch (body.action) {
    case 'create': {
      const res = createAdmin({ username: String(body.username ?? ''), name: String(body.name ?? ''), password: String(body.password ?? ''), role: role(body.role) });
      if (typeof res === 'string') return fail(res);
      audit(me.id, 'admin_created', null, `${res.username} (${res.role})`);
      break;
    }
    case 'reset': {
      if (!target) return fail('not_found', 404);
      if (target.id === me.id) return fail('use_own_password');
      const err = setPassword(target.id, String(body.password ?? ''), true);
      if (err) return fail(err);
      audit(me.id, 'admin_password_reset', null, target.username);
      break;
    }
    case 'update': {
      if (!target) return fail('not_found', 404);
      if (target.id === me.id && body.active === false) return fail('cannot_deactivate_self');
      const change = {
        active: typeof body.active === 'boolean' ? body.active : undefined,
        role: body.role ? role(body.role) : undefined,
        name: typeof body.name === 'string' ? body.name : undefined,
      };
      const err = updateAdmin(target.id, change);
      if (err) return fail(err);
      const what = [change.active === false && 'deactivated', change.active === true && 'reactivated', change.role && `role ${change.role}`, change.name !== undefined && `renamed to ${change.name.trim()}`].filter(Boolean).join(', ');
      audit(me.id, 'admin_updated', null, `${target.username}: ${what}`);
      break;
    }
    default:
      return fail('bad_action');
  }
  return json({ ok: true, admins: listAdmins() });
}
