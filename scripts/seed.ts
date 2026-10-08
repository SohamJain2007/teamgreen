/**
 * Demo data seeder for local development only: `npm run seed:demo` replaces demo reports. Never run it in production;
 * `npm run demo:clear` removes them again.
 * Every row is inserted with is_demo = 1 and the UI flags it as DEMO. Photos are synthetic illustrations.
 */
import sharp from 'sharp';
import { getDb } from '../src/lib/db';
import { getStorage } from '../src/lib/storage';
import { insertReport } from '../src/lib/reports';
import { getWard } from '../src/lib/wards';
import type { Category, Status } from '../src/lib/constants';

const DAY = 86_400_000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sceneSvg(seed: number, dirty: boolean, label: string): string {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const wall = pick(['#d9c7a8', '#c9b79a', '#bfae95', '#cdbd9e']);
  const road = pick(['#6f6a62', '#7a746b', '#5f5a53']);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd7e6"/><stop offset="1" stop-color="#e8e3d6"/></linearGradient></defs>
  <rect width="800" height="600" fill="url(#sky)"/>
  <rect y="190" width="800" height="150" fill="${wall}"/>
  <rect y="190" width="800" height="10" fill="#00000022"/>
  <rect y="340" width="800" height="260" fill="${road}"/>
  <rect y="338" width="800" height="8" fill="#a09a8e"/>`;
  for (let i = 0; i < 5; i++) s += `<rect x="${40 + i * 160 + r() * 30}" y="${215 + r() * 10}" width="70" height="90" fill="#00000012"/>`;
  // road markings
  for (let i = 0; i < 6; i++) s += `<rect x="${i * 150 + 20}" y="520" width="80" height="8" fill="#ffffff55"/>`;
  if (dirty) {
    const cx = 250 + r() * 300;
    const cy = 400 + r() * 60;
    const cols = ['#e8e8e8', '#2c2c2c', '#3f6db5', '#c0392b', '#d9a441', '#6b8e4e', '#8b6b4a', '#f0f0f0', '#555'];
    s += `<ellipse cx="${cx}" cy="${cy + 55}" rx="260" ry="45" fill="#00000030"/>`;
    for (let i = 0; i < 120; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      const x = cx + Math.cos(a) * d * 230;
      const y = cy + Math.sin(a) * d * 60 - (1 - d) * 60;
      const c = pick(cols);
      if (r() < 0.55) s += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${10 + r() * 24}" ry="${8 + r() * 18}" fill="${c}" stroke="#00000033"/>`;
      else {
        const w = 14 + r() * 36;
        const h = 8 + r() * 22;
        s += `<rect x="${(x - w / 2).toFixed(0)}" y="${(y - h / 2).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${c}" transform="rotate(${(r() * 90 - 45).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" stroke="#00000033"/>`;
      }
    }
  } else {
    s += `<rect x="${600 + r() * 60}" y="${300}" width="46" height="60" rx="6" fill="#2E7D4F"/><rect x="${596 + 0}" y="296" width="54" height="10" rx="4" fill="#1F5C38"/>`;
  }
  s += `<g transform="translate(24,548)"><rect width="${label.length * 15 + 24}" height="34" rx="6" fill="#1F1A17" opacity=".78"/><text x="12" y="23" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff" letter-spacing="2">${label}</text></g>`;
  return s + '</svg>';
}

async function makePhoto(seed: number, dirty: boolean, label: string) {
  const buf = Buffer.from(sceneSvg(seed, dirty, label));
  const full = await sharp(buf).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  const thumb = await sharp(buf).resize({ width: 480 }).jpeg({ quality: 65, mozjpeg: true }).toBuffer();
  return { full, thumb };
}

type Demo = {
  ward: number; cat: Category | null; status: Status; age: number; ack?: number; clr?: number; up: number; note?: string;
};
// ack / clr = days after the report was made.
const DEMOS: Demo[] = [
  { ward: 21, cat: 'mixed', status: 'reported', age: 3, up: 6, note: 'Bags piling up beside the road for days.' },
  { ward: 21, cat: 'drain', status: 'acknowledged', age: 9, ack: 2, up: 11, note: 'Nala blocked, water spills onto the road.' },
  { ward: 22, cat: 'burning', status: 'reported', age: 1, up: 3, note: 'Waste being burnt every evening. Heavy smoke.' },
  { ward: 22, cat: 'mixed', status: 'cleared', age: 18, ack: 1, clr: 4, up: 5 },
  { ward: 9, cat: 'construction', status: 'reported', age: 14, up: 9, note: 'Debris dumped on the footpath after house work.' },
  { ward: 9, cat: 'mixed', status: 'acknowledged', age: 6, ack: 1, up: 4 },
  { ward: 11, cat: 'dead_animal', status: 'cleared', age: 5, ack: 0.2, clr: 1, up: 7, note: 'Removed same day. Thanks!' },
  { ward: 11, cat: 'mixed', status: 'reported', age: 22, up: 14, note: 'Open dumping near the market corner. Long standing.' },
  { ward: 3, cat: 'mixed', status: 'cleared', age: 30, ack: 3, clr: 9, up: 3 },
  { ward: 5, cat: 'drain', status: 'reported', age: 7, up: 2 },
  { ward: 13, cat: 'mixed', status: 'acknowledged', age: 4, ack: 1, up: 5 },
  { ward: 14, cat: null, status: 'cleared', age: 25, ack: 2, clr: 6, up: 8 },
  { ward: 17, cat: 'construction', status: 'reported', age: 2, up: 1 },
  { ward: 18, cat: 'mixed', status: 'cleared', age: 12, ack: 1, clr: 3, up: 4 },
  { ward: 24, cat: 'burning', status: 'acknowledged', age: 8, ack: 4, up: 6, note: 'कचरा जलाया जा रहा है, धुआँ बहुत है।' },
  { ward: 25, cat: 'mixed', status: 'reported', age: 11, up: 5, note: 'कूड़ेदान भरा हुआ है, आसपास कचरा बिखरा है।' },
  { ward: 27, cat: 'mixed', status: 'cleared', age: 20, ack: 5, clr: 14, up: 2 },
  { ward: 28, cat: 'drain', status: 'reported', age: 5, up: 3 },
  { ward: 30, cat: 'mixed', status: 'acknowledged', age: 10, ack: 3, up: 7 },
  { ward: 36, cat: 'other', status: 'reported', age: 16, up: 4, note: 'Old furniture and mattresses left on the corner.' },
  { ward: 37, cat: 'mixed', status: 'cleared', age: 15, ack: 2, clr: 5, up: 3 },
  { ward: 42, cat: 'construction', status: 'acknowledged', age: 13, ack: 6, up: 2 },
  { ward: 43, cat: 'mixed', status: 'reported', age: 0.4, up: 1 },
  { ward: 46, cat: 'dead_animal', status: 'reported', age: 0.2, up: 2 },
  { ward: 48, cat: 'mixed', status: 'cleared', age: 35, ack: 4, clr: 21, up: 6, note: 'Took three weeks, but it was finally cleared.' },
  { ward: 51, cat: 'burning', status: 'reported', age: 19, up: 8 },
];

async function main() {
  const ifEmpty = process.argv.includes('--if-empty');
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) c FROM reports').get() as { c: number }).c;
  if (ifEmpty && count > 0) return;

  const st = getStorage();
  const old = db.prepare('SELECT id, photo, thumb, after_photo, after_thumb FROM reports WHERE is_demo = 1').all() as any[];
  for (const o of old) for (const k of [o.photo, o.thumb, o.after_photo, o.after_thumb]) if (k) await st.remove(k);
  db.prepare('DELETE FROM reports WHERE is_demo = 1').run();

  const now = Date.now();
  let n = 0;
  for (let i = 0; i < DEMOS.length; i++) {
    const d = DEMOS[i];
    const w = getWard(d.ward);
    if (!w || w.lat == null || w.lng == null) continue;
    const r = rng(1000 + i);
    // Jitter within ~350 m of the ward's (approximate) centroid; first report sits exactly on it, for testing duplicates.
    const dist = i === 0 ? 0 : 60 + r() * 290;
    const ang = r() * Math.PI * 2;
    const lat = w.lat + (Math.cos(ang) * dist) / 111_000;
    const lng = w.lng + (Math.sin(ang) * dist) / (111_000 * Math.cos((w.lat * Math.PI) / 180));
    const id = `DEMO${String(i + 1).padStart(4, '0')}`;
    const createdAt = Math.round(now - d.age * DAY);
    const before = await makePhoto(i + 1, true, 'DEMO · BEFORE');
    await st.put(`${id}.jpg`, before.full);
    await st.put(`${id}_t.jpg`, before.thumb);
    let after: { full: Buffer; thumb: Buffer } | null = null;
    if (d.status === 'cleared') {
      after = await makePhoto(i + 1, false, 'DEMO · AFTER');
      await st.put(`${id}_a.jpg`, after.full);
      await st.put(`${id}_a_t.jpg`, after.thumb);
    }
    insertReport({
      id, createdAt, lat: +lat.toFixed(6), lng: +lng.toFixed(6), accuracy: 10 + Math.round(r() * 25), locSource: 'gps',
      ward: d.ward, wardAuto: true, category: d.cat, note: d.note ?? null, photo: `${id}.jpg`, thumb: `${id}_t.jpg`,
      status: d.status,
      afterPhoto: after ? `${id}_a.jpg` : null, afterThumb: after ? `${id}_a_t.jpg` : null,
      acknowledgedAt: d.ack != null ? Math.round(createdAt + d.ack * DAY) : null,
      clearedAt: d.clr != null ? Math.round(createdAt + d.clr * DAY) : null,
      upvotes: d.up, isDemo: true,
    });
    n++;
  }
  console.log(`[seed] inserted ${n} demo reports (flagged is_demo=1)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
