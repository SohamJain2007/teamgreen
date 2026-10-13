/**
 * Back-office accounts: a few named people (owners and staff) instead of one shared password.
 * Passwords are scrypt-hashed; sessions live in the database so logout, resets and deactivation take effect at once.
 */
import crypto from 'node:crypto';
import { getDb } from './db';

export type Role = 'owner' | 'staff';
export type Admin = {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  mustChange: boolean;
  createdAt: number;
  lastLoginAt: number | null;
};

export const MIN_PASSWORD_LENGTH = 12;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

type Row = Record<string, any>;
const toAdmin = (r: Row): Admin => ({
  id: r.id,
  username: r.username,
  name: r.name,
  role: r.role,
  active: !!r.active,
  mustChange: !!r.must_change,
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

// ---------- passwords ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyHash(pw: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const got = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  return crypto.timingSafeEqual(got, expected);
}

// Compared against when the username does not exist, so a wrong username takes as long as a wrong password.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

export const normUsername = (u: string) => u.trim().toLowerCase();

/** Problems with a proposed password, or null if it is acceptable. */
export function passwordProblem(pw: string, username?: string): 'too_short' | 'too_long' | 'same_as_username' | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return 'too_short';
  if (pw.length > 200) return 'too_long';
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return 'same_as_username';
  return null;
}

// ---------- accounts ----------
export function countAdmins(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM admins').get() as Row).n;
}

/**
 * Creates the first owner from ADMIN_PASSWORD (username ADMIN_USERNAME, default "admin") when there are no accounts yet.
 * Once any account exists the variable is ignored, so changing it later does not change anyone's password.
 */
export function ensureBootstrapOwner(): void {
  if (countAdmins() > 0) return;
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < MIN_PASSWORD_LENGTH) return;
  const username = normUsername(process.env.ADMIN_USERNAME || 'admin');
  if (!USERNAME_RE.test(username)) return;
  getDb()
    .prepare("INSERT OR IGNORE INTO admins (username, name, pw_hash, role, created_at) VALUES (?, ?, ?, 'owner', ?)")
    .run(username, 'Owner', hashPassword(pw), Date.now());
}

/** True when someone can log in: an account exists, or ADMIN_PASSWORD is set so the first owner can be created. */
export function adminEnabled(): boolean {
  ensureBootstrapOwner();
  return countAdmins() > 0;
}

export function listAdmins(): Admin[] {
  return (getDb().prepare('SELECT * FROM admins ORDER BY active DESC, role, name COLLATE NOCASE').all() as Row[]).map(toAdmin);
}

export function getAdmin(id: number): Admin | null {
  const r = getDb().prepare('SELECT * FROM admins WHERE id = ?').get(id) as Row | undefined;
  return r ? toAdmin(r) : null;
}

const activeOwners = () => (getDb().prepare("SELECT COUNT(*) AS n FROM admins WHERE role='owner' AND active=1").get() as Row).n as number;

export type AccountError = 'bad_username' | 'username_taken' | 'bad_name' | 'too_short' | 'too_long' | 'same_as_username' | 'last_owner' | 'not_found';

export function createAdmin(input: { username: string; name: string; password: string; role: Role }): Admin | AccountError {
  const username = normUsername(input.username);
  const name = input.name.trim().slice(0, 60);
  if (!USERNAME_RE.test(username)) return 'bad_username';
  if (!name) return 'bad_name';
  const p = passwordProblem(input.password, username);
  if (p) return p;
  const db = getDb();
  if (db.prepare('SELECT 1 FROM admins WHERE username = ?').get(username)) return 'username_taken';
  const res = db
    .prepare('INSERT INTO admins (username, name, pw_hash, role, must_change, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run(username, name, hashPassword(input.password), input.role === 'owner' ? 'owner' : 'staff', Date.now());
  return getAdmin(Number(res.lastInsertRowid))!;
}

/** Sets a password. `byOwner` = an owner set it for someone else, who must then choose their own at next login. */
export function setPassword(id: number, password: string, byOwner: boolean): AccountError | null {
  const a = getAdmin(id);
  if (!a) return 'not_found';
  const p = passwordProblem(password, a.username);
  if (p) return p;
  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE admins SET pw_hash = ?, must_change = ? WHERE id = ?').run(hashPassword(password), byOwner ? 1 : 0, id);
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(id);
  })();
  return null;
}

export function updateAdmin(id: number, change: { active?: boolean; role?: Role; name?: string }): AccountError | null {
  const a = getAdmin(id);
  if (!a) return 'not_found';
  const losesOwner = a.role === 'owner' && a.active && (change.active === false || change.role === 'staff');
  if (losesOwner && activeOwners() <= 1) return 'last_owner';
  const name = change.name?.trim().slice(0, 60);
  if (change.name !== undefined && !name) return 'bad_name';
  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE admins SET active = ?, role = ?, name = ? WHERE id = ?').run(
      (change.active ?? a.active) ? 1 : 0,
      change.role ?? a.role,
      name ?? a.name,
      id,
    );
    if (change.active === false) db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(id);
  })();
  return null;
}

/** Returns the account if the username and password match an active account. */
export function checkLogin(username: string, password: string): Admin | null {
  ensureBootstrapOwner();
  const r = getDb().prepare('SELECT * FROM admins WHERE username = ?').get(normUsername(username)) as Row | undefined;
  const ok = verifyHash(password, r?.pw_hash ?? DUMMY_HASH);
  return ok && r && r.active ? toAdmin(r) : null;
}

export function checkOwnPassword(id: number, password: string): boolean {
  const r = getDb().prepare('SELECT pw_hash FROM admins WHERE id = ?').get(id) as Row | undefined;
  return verifyHash(password, r?.pw_hash ?? DUMMY_HASH) && !!r;
}

// ---------- sessions ----------
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(adminId: number): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const db = getDb();
  db.prepare('INSERT INTO admin_sessions (token_hash, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(tokenHash(token), adminId, now, now + SESSION_TTL_MS);
  db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(now, adminId);
  return token;
}

export function sessionAdmin(token: string): Admin | null {
  const r = getDb()
    .prepare('SELECT a.* FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > ? AND a.active = 1')
    .get(tokenHash(token), Date.now()) as Row | undefined;
  return r ? toAdmin(r) : null;
}

export function deleteSession(token: string): void {
  getDb().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash(token));
}

export function purgeExpiredSessions(): void {
  getDb().prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
}

// ---------- audit ----------
export type AuditEntry = { at: number; adminId: number | null; adminName: string | null; action: string; reportId: string | null; detail: string | null };

export function audit(adminId: number | null, action: string, reportId: string | null = null, detail: string | null = null): void {
  getDb().prepare('INSERT INTO admin_audit (at, admin_id, action, report_id, detail) VALUES (?, ?, ?, ?, ?)').run(Date.now(), adminId, action, reportId, detail);
}

const AUDIT_SELECT = `SELECT l.at, l.admin_id AS adminId, a.name AS adminName, l.action, l.report_id AS reportId, l.detail
  FROM admin_audit l LEFT JOIN admins a ON a.id = l.admin_id`;

export function listAudit(limit = 300): AuditEntry[] {
  return getDb().prepare(`${AUDIT_SELECT} ORDER BY l.at DESC, l.id DESC LIMIT ?`).all(limit) as AuditEntry[];
}

/** Latest admin action on each report, for the "last action by" line in the admin list. */
export function lastActionByReport(): Record<string, AuditEntry> {
  const rows = getDb()
    .prepare(`${AUDIT_SELECT} WHERE l.id IN (SELECT MAX(id) FROM admin_audit WHERE report_id IS NOT NULL GROUP BY report_id)`)
    .all() as AuditEntry[];
  return Object.fromEntries(rows.map((r) => [r.reportId!, r]));
}
