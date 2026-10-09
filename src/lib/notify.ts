/**
 * Sends verified complaints to officials: an email to RMC (photo attached) and the ward councillor (email if known in
 * data/wards.json, otherwise SMS). The reporter is CC'd on complaint emails when they gave an email.
 *
 * NOTIFY_MODE controls whether anything leaves the server:
 *   off      (default) nothing is queued or sent
 *   dry-run  everything is queued and logged as "dry_run", nothing is sent
 *   live     real email (SMTP) and SMS (SMS_PROVIDER) messages are sent
 * Councillors whose ward is not `verified: true` in data/wards.json are skipped unless NOTIFY_UNVERIFIED_CONTACTS=true,
 * so an unchecked phone number or email never receives complaints by accident.
 *
 * When a spot is cleared, the reporter is told by email and/or SMS (whichever they gave). REPORTER_NOTIFY_MODE takes the
 * same values and controls these separately, so reporters can be told without sending anything to officials.
 * SMS goes through SMS_PROVIDER: twilio or fast2sms.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { getDb } from './db';
import { addEvent, getContact, getReport, type Report } from './reports';
import { getEscalationContact, getWard, getWardFile } from './wards';
import { ESCALATION_STEPS, type EscalationStep, type NotifyRole } from './constants';
import { getStorage } from './storage';
import { normEmail, normPhone } from './contact';
import { translate } from './translations';

type Mode = 'off' | 'dry-run' | 'live';
type Channel = 'email' | 'sms' | 'whatsapp'; // whatsapp: rows from before it was replaced by SMS, never sent
type Kind = 'complaint' | EscalationStep | 'cleared';
type Row = { id: number; report_id: string; channel: Channel; kind: Kind; role: string | null; recipient: string; status: string; attempts: number };

const DAY = 86_400_000;
const stepOf = (kind: Kind) => ESCALATION_STEPS.find((s) => s.step === kind);

const MAX_ATTEMPTS = 5;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

const asMode = (m: string | undefined): Mode => (m === 'live' || m === 'dry-run' ? m : 'off');
/** Mode for complaints to officials. */
export function notifyMode(): Mode {
  return asMode(process.env.NOTIFY_MODE);
}
/** Mode for "your spot was cleared" messages to the reporter. */
export function reporterMode(): Mode {
  return asMode(process.env.REPORTER_NOTIFY_MODE);
}
const modeFor = (kind: Kind) => (kind === 'cleared' ? reporterMode() : notifyMode());

/** Councillor mobile (first one if several are "/"-separated) as 10 digits, or null. */
export const councillorMobile = (phone: string | null | undefined) => normPhone((phone ?? '').split('/')[0]);

/** Where complaints to RMC go. */
export const rmcEmail = () => process.env.RMC_EMAIL || getWardFile().meta.rmcHelpline.email;

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

const daysOpen = (r: Report) => Math.floor((Date.now() - (r.verifiedAt ?? r.createdAt)) / DAY);
const wardText = (r: Report) => {
  const w = r.ward != null ? getWard(r.ward) : undefined;
  return w ? `Ward ${w.wardNumber}${w.name ? ` (${w.name})` : ''}` : '';
};

/** Short complaint or escalation for an SMS (one or two SMS segments). */
export function complaintSms(r: Report, kind: Kind = 'complaint'): string {
  const where = wardText(r) ? ` in ${wardText(r)}` : '';
  const step = stepOf(kind);
  if (step) return `SafaiRanchi ${step.label}: complaint #${r.id}${where} is still not cleared after ${daysOpen(r)} days. Photo and location: ${reportUrl(r.id)}`;
  const what = r.category ? translate('en', `cat.${r.category}`) : 'Garbage spot';
  const n = Math.max(0, r.upvotes - 1);
  return `SafaiRanchi: new complaint #${r.id}${where}: ${what}${n ? `, confirmed by ${n} residents` : ''}. Photo and location: ${reportUrl(r.id)}`;
}

/** First lines of an escalation email (empty for the original complaint). */
function escalationIntro(r: Report, kind: Kind): string {
  const step = stepOf(kind);
  if (!step || !r.verifiedAt) return '';
  const sent = new Date(r.verifiedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
  return `${step.label.toUpperCase()}: this complaint was sent to RMC and the ward councillor on ${sent} and is still not cleared after ${daysOpen(r)} days.\n\n`;
}

/** Where a message to `role` about report `r` goes: [channel, address] or a reason it cannot be sent. */
function resolve(r: Report, role: NotifyRole): { channel: Channel; to: string } | { channel: Channel; label: string; skip: string } {
  const unverifiedOk = process.env.NOTIFY_UNVERIFIED_CONTACTS === 'true';
  if (role === 'rmc') {
    const to = rmcEmail();
    return to ? { channel: 'email', to } : { channel: 'email', label: 'RMC', skip: 'no RMC email' };
  }
  if (role === 'councillor') {
    // Email when we have one, otherwise SMS to their mobile.
    const w = r.ward != null ? getWard(r.ward) : undefined;
    if (!w) return { channel: 'sms', label: 'unknown ward', skip: 'report has no ward' };
    const email = normEmail(w.councillorEmail);
    const to = email ?? councillorMobile(w.councillorPhone);
    const channel: Channel = email ? 'email' : 'sms';
    if (!to) return { channel, label: `ward ${w.wardNumber}`, skip: 'no councillor email or valid mobile' };
    if (!w.verified && !unverifiedOk) return { channel, label: to, skip: `ward ${w.wardNumber} contact not verified (set verified:true in wards.json)` };
    return { channel, to };
  }
  const c = getEscalationContact(role);
  const email = normEmail(c?.email);
  const to = email ?? normPhone(c?.phone);
  const channel: Channel = email ? 'email' : 'sms';
  if (!to) return { channel, label: role, skip: `no email or mobile for ${role} in wards.json "escalation"` };
  if (!c!.verified && !unverifiedOk) return { channel, label: to, skip: `${role} contact not verified (set verified:true in wards.json "escalation")` };
  return { channel, to };
}

/** Queue one message per role for this report (a complaint or an escalation step) and start sending. */
export function enqueue(reportId: string, kind: Exclude<Kind, 'cleared'>, roles: readonly NotifyRole[]) {
  if (notifyMode() === 'off') return;
  const r = getReport(reportId);
  if (!r) return;
  const ins = getDb().prepare(
    'INSERT OR IGNORE INTO notifications (report_id, kind, role, channel, recipient, status, error, created_at) VALUES (?,?,?,?,?,?,?,?)',
  );
  const now = Date.now();
  for (const role of roles) {
    const d = resolve(r, role);
    if ('to' in d) ins.run(r.id, kind, role, d.channel, d.to, 'pending', null, now);
    else ins.run(r.id, kind, role, d.channel, d.label, 'skipped', d.skip, now);
  }
  void dispatchPending();
}

/** Queue deliveries for a newly verified report: RMC and the ward councillor. */
export function enqueueForReport(reportId: string) {
  enqueue(reportId, 'complaint', ['rmc', 'councillor']);
}

/**
 * Takes the next escalation step for every verified report that is still not cleared (called every few minutes).
 * If several steps are overdue at once (e.g. sending was switched on late), only the latest is sent.
 */
export function runEscalations(now = Date.now()) {
  if (notifyMode() === 'off') return;
  const db = getDb();
  const reports = db
    .prepare(
      `SELECT id, verified_at FROM reports WHERE verified_at IS NOT NULL AND verified_at <= ? AND status != 'cleared' AND hidden = 0 AND is_demo = 0`,
    )
    .all(now - ESCALATION_STEPS[0].day * DAY) as { id: string; verified_at: number }[];
  const done = db.prepare('SELECT step FROM escalations WHERE report_id = ?').pluck();
  const mark = db.prepare('INSERT OR IGNORE INTO escalations (report_id, step, at, sent) VALUES (?,?,?,?)');
  for (const { id, verified_at } of reports) {
    const taken = new Set(done.all(id) as string[]);
    const days = (now - verified_at) / DAY;
    const due = ESCALATION_STEPS.filter((s) => s.day <= days && !taken.has(s.step));
    if (!due.length) continue;
    const step = due[due.length - 1];
    db.transaction(() => {
      for (const s of due.slice(0, -1)) mark.run(id, s.step, now, 0);
      mark.run(id, step.step, now, 1);
      addEvent(id, 'escalated', `${step.label} (day ${step.day})`);
    })();
    enqueue(id, step.step, step.roles);
  }
}

/** Short message to the reporter that their spot was cleared, used for both email and SMS. */
export function clearedText(r: Report): string {
  const w = r.ward != null ? getWard(r.ward) : undefined;
  return `SafaiRanchi: the garbage spot you reported (#${r.id}${w ? `, Ward ${w.wardNumber}` : ''}) has been marked cleared. See the after photo, or say it is still dirty: ${reportUrl(r.id)}`;
}

/** Queue "your spot was cleared" messages to the reporter and start sending. */
export function enqueueCleared(reportId: string) {
  if (reporterMode() === 'off') return;
  const { email, phone } = getContact(reportId);
  if (!email && !phone) return;
  const ins = getDb().prepare(
    "INSERT OR IGNORE INTO notifications (report_id, channel, kind, role, recipient, status, created_at) VALUES (?,?,'cleared','reporter',?,'pending',?)",
  );
  const now = Date.now();
  if (email) ins.run(reportId, 'email', email, now);
  if (phone) ins.run(reportId, 'sms', phone, now);
  void dispatchPending();
}

let running = false;
/** Sends every pending/failed delivery that still has attempts left. Safe to call often. */
export async function dispatchPending() {
  if (running || (notifyMode() === 'off' && reporterMode() === 'off')) return;
  running = true;
  try {
    const db = getDb();
    // Only kinds whose sending is switched on; the others stay pending.
    const only = notifyMode() === 'off' ? "AND kind = 'cleared'" : reporterMode() === 'off' ? "AND kind != 'cleared'" : '';
    const rows = db
      .prepare(`SELECT * FROM notifications WHERE status IN ('pending','failed') AND attempts < ? ${only} ORDER BY id LIMIT 20`)
      .all(MAX_ATTEMPTS) as Row[];
    for (const row of rows) {
      const r = getReport(row.report_id);
      if (!r || r.hidden) {
        db.prepare("UPDATE notifications SET status='skipped', error='report removed' WHERE id=?").run(row.id);
        continue;
      }
      if (row.channel === 'whatsapp') {
        db.prepare("UPDATE notifications SET status='skipped', error='WhatsApp sending was removed' WHERE id=?").run(row.id);
        continue;
      }
      const mode = modeFor(row.kind);
      try {
        const cleared = row.kind === 'cleared';
        if (mode === 'live') {
          if (cleared) await (row.channel === 'sms' ? sendSms(row.recipient, clearedText(r)) : sendClearedEmail(r, row.recipient));
          else if (row.channel === 'email') await sendEmail(r, row.recipient, row.kind);
          else await sendSms(row.recipient, complaintSms(r, row.kind));
        } else {
          const body = cleared ? clearedText(r) : row.channel === 'sms' ? complaintSms(r, row.kind) : escalationIntro(r, row.kind) + complaintText(r);
          const cc = !cleared && row.channel === 'email' ? getContact(r.id).email : null;
          console.log(`[notify dry-run] ${row.kind} ${row.channel} -> ${row.recipient}${cc ? ` (cc ${cc})` : ''}\n${body}`);
        }
        db.prepare('UPDATE notifications SET status=?, error=NULL, attempts=attempts+1, sent_at=? WHERE id=?').run(
          mode === 'live' ? 'sent' : 'dry_run', Date.now(), row.id,
        );
        // The public timeline only shows deliveries to officials, never that the reporter was contacted.
        if (row.kind === 'complaint') addEvent(r.id, 'notified', `${row.channel}${mode === 'live' ? '' : ' (dry run)'}`);
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

async function sendEmail(r: Report, to: string, kind: Kind = 'complaint') {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error('MAIL_FROM not set');
  const w = r.ward != null ? getWard(r.ward) : undefined;
  const photo = await getStorage().get(r.photo);
  const text = complaintText(r) + (w?.councillorName ? `\nWard councillor: ${w.councillorName}${w.councillorPhone ? `, ${w.councillorPhone}` : ''}` : '');
  // The reporter is copied so they can follow up with the officials directly.
  const cc = getContact(r.id).email ?? undefined;
  await mailer().sendMail({
    from,
    to,
    cc: cc && cc !== to ? cc : undefined,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    subject: `${stepOf(kind) ? `[${stepOf(kind)!.label}, ${daysOpen(r)} days] ` : ''}Garbage complaint #${r.id}${w ? ` - Ward ${w.wardNumber}${w.name ? ` (${w.name})` : ''}` : ''}, Ranchi`,
    text: `${escalationIntro(r, kind)}${text}\n\nThis complaint was reported and verified by citizens on SafaiRanchi, an independent citizen platform. Please update its status at the link above.`,
    attachments: photo ? [{ filename: `complaint-${r.id}.jpg`, content: photo, contentType: 'image/jpeg' }] : [],
  });
}

async function sendClearedEmail(r: Report, to: string) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error('MAIL_FROM not set');
  await mailer().sendMail({
    from,
    to,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    subject: `Cleared: the garbage spot you reported (#${r.id})`,
    text: `${clearedText(r)}\n\nThank you for helping keep Ranchi clean.\nYou are getting this one-time message because you left this email when reporting the spot.`,
  });
}

/** SMS to a 10-digit Indian mobile. Indian SMS rules (DLT) apply; see README. */
async function sendSms(phone: string, text: string) {
  const provider = process.env.SMS_PROVIDER;
  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM not set');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
      body: new URLSearchParams({ To: `+91${phone}`, From: from, Body: text }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } else if (provider === 'fast2sms') {
    const key = process.env.FAST2SMS_API_KEY;
    if (!key) throw new Error('FAST2SMS_API_KEY not set');
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'q', message: text, numbers: phone }),
    });
    const body = await res.text();
    if (!res.ok || !/"return"\s*:\s*true/.test(body)) throw new Error(`Fast2SMS ${res.status}: ${body.slice(0, 300)}`);
  } else throw new Error('SMS_PROVIDER not set (twilio or fast2sms)');
}
