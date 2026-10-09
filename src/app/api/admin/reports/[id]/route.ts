import { json, fail } from '@/lib/api';
import { isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { processPhoto } from '@/lib/image';
import { addEvent, deleteReport, getReport, markCleared, maybeVerify, reopen } from '@/lib/reports';
import { enqueueCleared, enqueueForReport, retryFailed } from '@/lib/notify';
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
      addEvent(id, 'acknowledged', 'admin');
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
        const keys = { photo: `${id}_a${stamp}.jpg`, thumb: `${id}_a${stamp}_t.jpg` };
        await st.put(keys.photo, p.full);
        await st.put(keys.thumb, p.thumb);
        markCleared(id, 'admin', keys);
      } else markCleared(id, 'admin');
      enqueueCleared(id);
      break;
    }
    case 'reopen':
      reopen(id, 'admin');
      break;
    case 'verify':
      if (maybeVerify(id, 0, true)) enqueueForReport(id);
      break;
    case 'retry':
      retryFailed(id);
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
