/**
 * Background upkeep for a long-running server (Railway): escalates uncleared complaints, retries undelivered messages, keeps a daily
 * database snapshot, and clears expired rate-limit rows. Started once from src/instrumentation.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { closeDb, dbPath, getDb } from './db';
import { dispatchPending, runEscalations } from './notify';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const KEEP_BACKUPS = 7;

const backupDir = () => process.env.BACKUP_DIR || path.join(path.dirname(dbPath()), 'backups');

/** Consistent online snapshot of the database (safe while the app is writing). Keeps the newest KEEP_BACKUPS. */
export async function backupNow(): Promise<string> {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `safai-${new Date().toISOString().slice(0, 10)}.db`);
  await getDb().backup(file);
  const old = fs.readdirSync(dir).filter((f) => /^safai-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return file;
}

function lastBackupAt(): number {
  try {
    const files = fs.readdirSync(backupDir()).filter((f) => f.endsWith('.db'));
    return Math.max(0, ...files.map((f) => fs.statSync(path.join(backupDir(), f)).mtimeMs));
  } catch {
    return 0;
  }
}

async function tick() {
  try {
    runEscalations();
    await dispatchPending();
    getDb().prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(Date.now());
    if (Date.now() - lastBackupAt() > DAY) console.log('[maintenance] backup written:', await backupNow());
  } catch (e) {
    console.error('[maintenance]', e);
  }
}

function checkConfig() {
  const missing = [
    !process.env.ADMIN_PASSWORD && 'ADMIN_PASSWORD (admin panel is disabled)',
    (!process.env.IP_HASH_SALT || process.env.IP_HASH_SALT === 'change-me-too') && 'IP_HASH_SALT (using a default salt)',
    !process.env.NEXT_PUBLIC_SITE_URL && 'NEXT_PUBLIC_SITE_URL (links in messages will point to localhost)',
  ].filter(Boolean);
  if (missing.length) console.warn(`[config] not set: ${missing.join('; ')}`);
}

export function startMaintenance() {
  checkConfig();
  setTimeout(tick, 15_000);
  setInterval(tick, 5 * MINUTE).unref();
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, () => {
      try {
        closeDb();
      } finally {
        process.exit(0);
      }
    });
  }
}
