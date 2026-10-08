import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'safai.db');

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

CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
`;

const g = globalThis as unknown as { __safaiDb?: Database.Database };

export function getDb(): Database.Database {
  if (!g.__safaiDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    g.__safaiDb = db;
  }
  return g.__safaiDb;
}
