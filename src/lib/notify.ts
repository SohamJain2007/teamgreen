/**
 * Sends verified complaints to officials: an email to RMC (photo attached) and a WhatsApp message to the ward councillor.
 *
 * NOTIFY_MODE controls whether anything leaves the server:
 *   off      (default) nothing is queued or sent
 *   dry-run  everything is queued and logged as "dry_run", nothing is sent
 *   live     real email (SMTP) and WhatsApp (Meta Cloud API) messages are sent
 * Councillors whose ward is not `verified: true` in data/wards.json are skipped unless NOTIFY_UNVERIFIED_CONTACTS=true,
 * so an unchecked phone number never receives complaints by accident.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { getDb } from './db';
import { addEvent, getReport, type Report } from './reports';
import { getWard, getWardFile } from './wards';
import { getStorage } from './storage';
import { translate } from './translations';

type Mode = 'off' | 'dry-run' | 'live';
type Channel = 'email' | 'whatsapp';
type Row = { id: number; report_id: string; channel: Channel; recipient: string; status: string; attempts: number };

const MAX_ATTEMPTS = 5;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function notifyMode(): Mode {
  const m = process.env.NOTIFY_MODE;
  return m === 'live' || m === 'dry-run' ? m : 'off';
}

/** Indian mobile number (first one if several are "/"-separated) as WhatsApp wants it: 91XXXXXXXXXX. */
export function waNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? '').split('/')[0].replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  return null;
}

export const mapsUrl = (r: Pick<Report, 'lat' | 'lng'>) => `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
export const reportUrl = (id: string) => `${SITE}/r/${id}`;

/** Plain-text complaint, shared by the email body and the citizen's one-tap WhatsApp/email buttons. */
export function complaintText(r: Report): string {
  const w = r.ward != null ? getWard(r.ward) : undefined;
  const what = r.category ? translate('en', `cat.${r.category}`) : 'Garbage spot';
  return [
    `Garbage complaint #${r.id} (SafaiRanchi)`,
    `${what}${w ? `, Ward ${w.wardNumber}${w.name ? ` (${w.name})` : ''}` : ''}`,
    r.note ? `Note: ${r.note}` : null,
    `Location: ${mapsUrl(r)}`,
    `Photo and status: ${reportUrl(r.id)}`,
    `Reported ${new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}; confirmed by ${Math.max(0, r.upvotes - 1)} other people nearby.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Queue deliveries for a newly verified report and start sending. */
export function enqueueForReport(reportId: string) {
  const mode = notifyMode();
  if (mode === 'off') return;
  const r = getReport(reportId);
  if (!r) return;
  const db = getDb();
  const ins = db.prepare(
    'INSERT OR IGNORE INTO notifications (report_id, channel, recipient, status, error, created_at) VALUES (?,?,?,?,?,?)',
  );
  const now = Date.now();

  const rmcEmail = process.env.RMC_EMAIL || getWardFile().meta.rmcHelpline.email;
  if (rmcEmail) ins.run(r.id, 'email', rmcEmail, 'pending', null, now);

  const w = r.ward != null ? getWard(r.ward) : undefined;
  const num = waNumber(w?.councillorPhone);
  if (!w) ins.run(r.id, 'whatsapp', 'unknown ward', 'skipped', 'report has no ward', now);
  else if (!num) ins.run(r.id, 'whatsapp', `ward ${w.wardNumber}`, 'skipped', 'no valid councillor phone', now);
  else if (!w.verified && process.env.NOTIFY_UNVERIFIED_CONTACTS !== 'true')
    ins.run(r.id, 'whatsapp', num, 'skipped', `ward ${w.wardNumber} contact not verified (set verified:true in wards.json)`, now);
  else ins.run(r.id, 'whatsapp', num, 'pending', null, now);

  void dispatchPending();
}

let running = false;
/** Sends every pending/failed delivery that still has attempts left. Safe to call often. */
export async function dispatchPending() {
  if (running || notifyMode() === 'off') return;
  running = true;
  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM notifications WHERE status IN ('pending','failed') AND attempts < ? ORDER BY id LIMIT 20")
      .all(MAX_ATTEMPTS) as Row[];
    for (const row of rows) {
      const r = getReport(row.report_id);
      if (!r || r.hidden) {
        db.prepare("UPDATE notifications SET status='skipped', error='report removed' WHERE id=?").run(row.id);
        continue;
      }
      try {
        const mode = notifyMode();
        if (mode === 'live') await (row.channel === 'email' ? sendEmail(r, row.recipient) : sendWhatsApp(r, row.recipient));
        else console.log(`[notify dry-run] ${row.channel} -> ${row.recipient}\n${complaintText(r)}`);
        db.prepare('UPDATE notifications SET status=?, error=NULL, attempts=attempts+1, sent_at=? WHERE id=?').run(
          mode === 'live' ? 'sent' : 'dry_run', Date.now(), row.id,
        );
        addEvent(r.id, 'notified', `${row.channel}${mode === 'live' ? '' : ' (dry run)'}`);
      } catch (e) {
        db.prepare("UPDATE notifications SET status='failed', error=?, attempts=attempts+1 WHERE id=?").run(String(e).slice(0, 500), row.id);
      }
    }
  } finally {
    running = false;
  }
}

export function listNotifications(reportId?: string) {
  const db = getDb();
  return (reportId
    ? db.prepare('SELECT * FROM notifications WHERE report_id = ? ORDER BY id').all(reportId)
    : db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 200').all()) as (Row & { error: string | null; sent_at: number | null; created_at: number })[];
}

/** Admin "retry": give failed rows a fresh set of attempts. */
export function retryFailed(reportId: string) {
  getDb().prepare("UPDATE notifications SET status='pending', attempts=0 WHERE report_id=? AND status='failed'").run(reportId);
  void dispatchPending();
}

// ---------- channels ----------
let transport: Transporter | null = null;
function mailer() {
  if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST not set');
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

async function sendEmail(r: Report, to: string) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error('MAIL_FROM not set');
  const w = r.ward != null ? getWard(r.ward) : undefined;
  const photo = await getStorage().get(r.photo);
  const text = complaintText(r) + (w?.councillorName ? `\nWard councillor: ${w.councillorName}${w.councillorPhone ? `, ${w.councillorPhone}` : ''}` : '');
  await mailer().sendMail({
    from,
    to,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    subject: `Garbage complaint #${r.id}${w ? ` - Ward ${w.wardNumber}${w.name ? ` (${w.name})` : ''}` : ''}, Ranchi`,
    text: `${text}\n\nThis complaint was reported and verified by citizens on SafaiRanchi, an independent citizen platform. Please update its status at the link above.`,
    attachments: photo ? [{ filename: `complaint-${r.id}.jpg`, content: photo, contentType: 'image/jpeg' }] : [],
  });
}

/**
 * WhatsApp Business (Meta Cloud API). Messages to officials are business-initiated, so they must use a template
 * approved in Meta Business Manager. Expected template body (5 parameters), see README:
 *   "New garbage complaint #{{1}} in {{2}}: {{3}}. Location: {{4}} Photo and status: {{5}}"
 */
async function sendWhatsApp(r: Report, to: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE;
  if (!token || !phoneId || !template) throw new Error('WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TEMPLATE not set');
  const w = r.ward != null ? getWard(r.ward) : undefined;
  const params = [
    r.id,
    w ? `Ward ${w.wardNumber}${w.name ? ` (${w.name})` : ''}` : 'Ranchi',
    r.category ? translate('en', `cat.${r.category}`) : 'Garbage spot',
    mapsUrl(r),
    reportUrl(r.id),
  ];
  const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v21.0'}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
