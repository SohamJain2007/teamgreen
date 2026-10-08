# SafaiRanchi (working name)

A civic PWA for Ranchi: citizens report garbage black spots in about 30 seconds (photo + GPS, no sign-up) and every report
is tracked publicly (Reported → Acknowledged → Cleared) against the ward and its councillor.

Independent project, **not affiliated with Ranchi Municipal Corporation (RMC)**. Reports are not forwarded to RMC automatically.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000  (3001 if 3000 is busy)
```

`npm run dev` first runs `predev`, which seeds ~26 clearly-flagged **DEMO** reports if the database is empty. No API keys needed.
Admin: `/admin`. It stays disabled until you set `ADMIN_PASSWORD` (12+ characters) in `.env`; there is no default password.

Other scripts: `npm run seed` (replace demo data), `npm run build && npm start` (production; **the service worker only registers in production builds**), `npm run icons` (regenerate PWA icons), `npm run lint` (typecheck).

## Environment variables (see `.env.example`)

| Var | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Required (12+ characters). Admin is disabled without it, in dev and production. Generate one with `openssl rand -base64 18`. |
| `IP_HASH_SALT` | Salt for hashing IPs (rate limiting, one-vote-per-person). Set a long random value. No raw IPs are stored. |
| `UPLOAD_DIR` | Photo folder (default `./uploads`). |
| `STORAGE_DRIVER` | `local` (default). `s3` is a stub, see below. |
| `DATABASE_PATH` | SQLite file (default `./data/safai.db`). |
| `NEXT_PUBLIC_SITE_URL` | Public URL for share/OG metadata. |

## Updating ward and official data

All of it lives in **`data/wards.json`**: `meta` (helpline, map centre), `rmcOfficials` (Mayor, Deputy Mayor, Commissioner, health officer) and `wards`.
Edit by hand; changes are picked up without a rebuild when the file is on disk. Ward fields: `wardNumber, zone, name, area, councillorName, councillorPhone, lat, lng, centroidSource, source, verified`.
Set `verified: true` only after checking an official source; until then the UI shows a "Data not yet verified" badge. Councillors, phones and areas come from the 2026 RMC ward member list (53 wards); each ward also has an `area` field with the full area description.
See **`DATA_TODO.md`** for exactly what is unverified or missing.

**Ward boundaries (optional, recommended):** drop a GeoJSON `FeatureCollection` at `data/ward-boundaries.geojson`; each feature needs a `Polygon`/`MultiPolygon` geometry and `properties.wardNumber` (also accepts `ward`, `WARD_NO`, `Ward_No`). Detection then uses point-in-polygon and falls back to nearest centroid outside any polygon.

## How it is built

- Next.js 15 (App Router) + TypeScript + Tailwind; SQLite via `better-sqlite3` (schema auto-created in `src/lib/db.ts`); photos via `sharp`.
- `src/lib/storage.ts`: photo storage interface (`LocalStorage` now; `S3Storage` is a stub to implement). Reports only store keys.
- Uploads are re-encoded server-side (auto-rotate, max 1280 px, JPEG, **all EXIF dropped**) and compressed client-side first for 4G. Stored GPS is only the browser geolocation or map pin the user chose.
- Abuse: per-IP (salted hash) rate limits in SQLite (6 reports/h, votes/flags/login limits), honeypot field, 10 MB cap, 3 spam flags auto-hide a report, location must be within 30 km of Ranchi.
- Duplicates: a new report within 30 m of an open one offers "Add your voice" (upvote).
- i18n: `src/lib/translations.ts` (English + Hindi), choice stored in the `sr_lang` cookie.
- Map: Leaflet + OpenStreetMap tiles (no keys). The OSM tile server is for light use; for real traffic use a tile provider or your own server (change `TILE_URL` in `MapViewImpl.tsx`).
- PWA: `app/manifest.ts`, `public/sw.js` (shell caching, offline page, capped tile cache), icons in `public/icons`.

## Deploying

SQLite and local photos need a **persistent disk**, so a plain Vercel serverless deployment will lose data. Options:
1. **A VM/container with a volume** (Fly.io, Railway, Render with disk, a VPS): `npm run build && npm start`, mount a volume, set `DATABASE_PATH` and `UPLOAD_DIR` to it, plus `ADMIN_PASSWORD`, `IP_HASH_SALT`, `NEXT_PUBLIC_SITE_URL`. Serve over HTTPS (needed for geolocation, camera and the service worker).
2. **Vercel**: swap SQLite for a hosted DB (Turso/libSQL, Neon Postgres: the SQL in `src/lib/reports.ts` and `db.ts` is small) and implement `S3Storage` (S3/R2/Vercel Blob). Rate limiting also needs a shared store there.
Run a single instance (SQLite writer). Do not run `npm run seed` in production.

## Status

**Done and tested end to end** (headless Chromium, Pixel 7 profile, plus API calls): photo → GPS → submit in 2 taps after the photo; duplicate prompt and upvote; ward auto-detect with manual override; denied-GPS pin fallback; map/list/filters; report page with timeline; admin acknowledge/clear with after-photo; before/after view; EXIF stripping; rate limit, auth and validation errors; Hindi toggle; production build.

**Stubbed / limited**
- `S3Storage` is not implemented. No automatic forwarding of reports to RMC.
- Ward detection is nearest *approximate* centroid unless you add boundaries.
- Public tracker loads all reports (cap 2000) client-side, with no clustering or pagination.
- No offline report queue (reports need a connection). No push notifications, no email.
- Rate limits are per salted IP hash, so users behind one carrier NAT share a bucket.
- Admin is a single shared password with a 12 h cookie.
- Demo photos are synthetic illustrations, not real places.
- Hindi strings were written by me and should be reviewed by a native speaker. Also check the Hindi wording of the unverified-data notices.

**You must verify**: all of `DATA_TODO.md` (councillors, zones, ward names, boundaries, centroids, officials, helpline), and decide on the project name and whether to keep the independence disclaimer.
