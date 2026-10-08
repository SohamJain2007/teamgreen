import { json, fail } from '@/lib/api';
import { isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { processPhoto } from '@/lib/image';
import { deleteReport, getReport } from '@/lib/reports';
import { getStorage } from '@/lib/storage';
import { MAX_UPLOAD_BYTES } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return fail('unauthorized', 401);
  const { id } = await ctx.params;
  const r = getReport(id);
  if (!r) return fail('not_found', 404);
  const form = await req.formData().catch(() => null);
  if (!form) return fail('bad_form');
  const action = String(form.get('action'));
  const db = getDb();
  const now = Date.now();

  switch (action) {
    case 'acknowledge':
      db.prepare("UPDATE reports SET status='acknowledged', acknowledged_at=COALESCE(acknowledged_at, ?), cleared_at=NULL WHERE id=?").run(now, id);
      break;
    case 'clear': {
      const after = form.get('after');
      if (after instanceof File && after.size > 0) {
        if (after.size > MAX_UPLOAD_BYTES) return fail('photo_too_large', 413);
        let p;
        try {
          p = await processPhoto(Buffer.from(await after.arrayBuffer()));
        } catch {
          return fail('photo_invalid');
        }
        const st = getStorage();
        const stamp = Date.now().toString(36);
        const key = `${id}_a${stamp}.jpg`;
        const tkey = `${id}_a${stamp}_t.jpg`;
        await st.put(key, p.full);
        await st.put(tkey, p.thumb);
        db.prepare('UPDATE reports SET after_photo=?, after_thumb=? WHERE id=?').run(key, tkey, id);
      }
      // Acknowledged timestamp is back-filled so the timeline never shows Cleared without Acknowledged.
      db.prepare("UPDATE reports SET status='cleared', cleared_at=?, acknowledged_at=COALESCE(acknowledged_at, ?) WHERE id=?").run(now, now, id);
      break;
    }
    case 'reopen':
      db.prepare("UPDATE reports SET status='reported', acknowledged_at=NULL, cleared_at=NULL WHERE id=?").run(id);
      break;
    case 'hide':
      db.prepare('UPDATE reports SET hidden=1 WHERE id=?').run(id);
      break;
    case 'restore':
      db.prepare('UPDATE reports SET hidden=0, spam_flags=0 WHERE id=?').run(id);
      db.prepare("DELETE FROM votes WHERE report_id=? AND kind='spam'").run(id);
      break;
    case 'delete':
      await deleteReport(id);
      return json({ ok: true, deleted: true });
    default:
      return fail('bad_action');
  }
  return json({ ok: true, report: getReport(id) });
}
