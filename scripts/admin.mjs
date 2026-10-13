// Back-office account recovery from the server shell (e.g. `railway ssh`), for when nobody can log in to /admin.
//   node scripts/admin.mjs list
//   node scripts/admin.mjs reset <username>                  new temporary password; also reactivates the account
//   node scripts/admin.mjs add <username> "<Full name>" [owner|staff]
// Temporary passwords are printed once; the person must choose their own at next login. Day-to-day, owners manage
// accounts in /admin → Team. Hashing must match src/lib/admins.ts.
import crypto from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'safai.db');
const SCRYPT = { N: 16384, r: 8, p: 1 };
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

const hashPassword = (pw) => {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(pw, salt, 32, SCRYPT).toString('hex')}`;
};
const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const tempPassword = () => Array.from(crypto.randomBytes(16), (x) => alphabet[x % alphabet.length]).join('');
const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

const db = new Database(DB_PATH, { fileMustExist: true });
db.pragma('busy_timeout = 5000');
if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='admins'").get())
  die(`No admins table in ${DB_PATH}. Start the app once so it creates the schema.`);
const audit = (action, detail) =>
  db.prepare('INSERT INTO admin_audit (at, admin_id, action, report_id, detail) VALUES (?, NULL, ?, NULL, ?)').run(Date.now(), action, `${detail} (server shell)`);

const [cmd, rawUser, name, role = 'staff'] = process.argv.slice(2);
const username = rawUser?.trim().toLowerCase();

if (cmd === 'list') {
  const rows = db.prepare('SELECT username, name, role, active, must_change, last_login_at FROM admins ORDER BY role, username').all();
  if (!rows.length) console.log('No accounts yet. Set ADMIN_PASSWORD and open /admin to create the first owner.');
  for (const r of rows)
    console.log(
      [r.username.padEnd(20), r.role.padEnd(6), r.active ? 'active  ' : 'INACTIVE', r.last_login_at ? new Date(r.last_login_at).toISOString() : 'never logged in', r.name].join('  '),
    );
} else if (cmd === 'reset' && username) {
  const pw = tempPassword();
  const a = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (!a) die(`No account "${username}". Run: node scripts/admin.mjs list`);
  db.transaction(() => {
    db.prepare('UPDATE admins SET pw_hash = ?, must_change = 1, active = 1 WHERE id = ?').run(hashPassword(pw), a.id);
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(a.id);
    audit('admin_password_reset', username);
  })();
  console.log(`Temporary password for ${username}: ${pw}\nThey will be asked to choose their own at next login.`);
} else if (cmd === 'add' && username && name) {
  if (!USERNAME_RE.test(username)) die('Username: 3-32 characters, lowercase letters, digits, dot, dash or underscore.');
  if (!['owner', 'staff'].includes(role)) die('Role must be owner or staff.');
  if (db.prepare('SELECT 1 FROM admins WHERE username = ?').get(username)) die(`"${username}" already exists. Use reset.`);
  const pw = tempPassword();
  db.prepare('INSERT INTO admins (username, name, pw_hash, role, must_change, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(username, name.trim().slice(0, 60), hashPassword(pw), role, Date.now());
  audit('admin_created', `${username} (${role})`);
  console.log(`Created ${role} ${username}. Temporary password: ${pw}\nThey will be asked to choose their own at next login.`);
} else {
  die('Usage:\n  node scripts/admin.mjs list\n  node scripts/admin.mjs reset <username>\n  node scripts/admin.mjs add <username> "<Full name>" [owner|staff]');
}
db.close();
