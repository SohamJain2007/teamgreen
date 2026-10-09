import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Vercel's filesystem is read-only except /tmp, so default there (data does not survive cold starts; see README).
const DB_PATH = process.env.DATABASE_PATH || (process.env.VERCEL ? '/tmp/safai.db' : path.join(process.cwd(), 'data', 'safai.db'));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reports (
  id              TEXT PRIMARY KEY,
  created_at      INTEGER NOT NULL,
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  accuracy        REAL,
  loc_source      TEXT NOT NULL DEFAULT 'gps',      -- gps | pin
  ward            INTEGER,
  ward_auto       INTEGER NOT NULL DEFAULT 1,       -- 1 = auto-detected, 0 = chosen by reporter
  category        TEXT,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'reported', -- reported | acknowledged | cleared
  photo           TEXT NOT NULL,
  thumb           TEXT NOT NULL,
  after_photo     TEXT,
  after_thumb     TEXT,
  acknowledged_at INTEGER,
  cleared_at      INTEGER,
  upvotes         INTEGER NOT NULL DEFAULT 1,
  spam_flags      INTEGER NOT NULL DEFAULT 0,
  hidden          INTEGER NOT NULL DEFAULT 0,
  is_demo         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_ward ON reports(ward);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_geo ON reports(lat, lng);

-- One vote / spam flag per (hashed) client. No raw IPs are stored anywhere.
CREATE TABLE IF NOT EXISTS votes (
  report_id  TEXT NOT NULL,
  kind       TEXT NOT NULL,            -- up | spam
  client     TEXT NOT NULL,            -- salted SHA-256 of IP
  created_at INTEGER NOT NULL,
  PRIMARY KEY (report_id, kind, client)
);

-- Audit trail shown on the report timeline: reported, confirmed, verified, notified, acknowledged, cleared, reopened.
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL,
  at         INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  detail     TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_report ON events(report_id, at);

-- Outbox for complaints sent to officials (email to RMC, WhatsApp to councillor). One row per delivery.
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL,
  channel    TEXT NOT NULL,            -- email | whatsapp
  recipient  TEXT NOT NULL,
  status     TEXT NOT NULL,            -- pending | sent | dry_run | skipped | failed
  error      TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  sent_at    INTEGER,
  UNIQUE (report_id, channel, recipient)
);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
`;

const g = globalThis as unknown as { __safaiDb?: Database.Database };

export const dbPath = () => DB_PATH;

/** Flushes the WAL and closes the database (on shutdown). */
export function closeDb() {
  if (!g.__safaiDb) return;
  g.__safaiDb.pragma('wal_checkpoint(TRUNCATE)');
  g.__safaiDb.close();
  g.__safaiDb = undefined;
}

export function getDb(): Database.Database {
  if (!g.__safaiDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.exec(SCHEMA);
    migrate(db);
    g.__safaiDb = db;
  }
  return g.__safaiDb;
}

/** Columns added after the first release. SQLite has no ADD COLUMN IF NOT EXISTS, so check table_info. */
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  ['reports', 'verified_at', 'INTEGER'],          // set when enough people nearby confirm the spot
  ['reports', 'cleared_by', 'TEXT'],              // admin | citizen
  ['reports', 'reopen_flags', 'INTEGER NOT NULL DEFAULT 0'], // "still dirty" votes since the last clear
  ['reports', 'contact_email', 'TEXT'],            // reporter's, private: only used to tell them it was cleared
  ['reports', 'contact_phone', 'TEXT'],            // 10-digit Indian mobile, same
  ['notifications', 'kind', "TEXT NOT NULL DEFAULT 'complaint'"], // complaint (to officials) | cleared (to reporter)
];

function migrate(db: Database.Database) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}
