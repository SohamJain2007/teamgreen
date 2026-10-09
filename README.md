# SafaiRanchi (working name)

A civic PWA for Ranchi: citizens report garbage black spots in about 30 seconds (photo + GPS, no sign-up) and every report
is tracked publicly (Reported → Acknowledged → Cleared) against the ward and its councillor.

Independent project, **not affiliated with Ranchi Municipal Corporation (RMC)**. Reports are public records: every spot is tied to the ward councillor, MLA, MP, Mayor and RMC officer chain responsible for it, with public stats on how many dumps are unresolved and for how long. Nothing is sent to RMC automatically.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000  (3001 if 3000 is busy)
```

The app starts with **no data**: every report is real. For local UI testing only, `npm run seed:demo` adds ~26 flagged DEMO reports and `npm run demo:clear` removes them. No API keys are needed to run it.
Admin: `/admin`. It stays disabled until you set `ADMIN_PASSWORD` (12+ characters) in `.env`; there is no default password.

Other scripts: `npm run build && npm start` (production; **the service worker only registers in production builds**), `npm run icons` (regenerate PWA icons), `npm run lint` (typecheck).

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

## Public accountability

- **Report page**: severity (Critical / Moderate / Minor, see `severity()` in `src/lib/reports.ts`), status timeline, "I see this too"
  confirmations (GPS within 250 m), and a "Who is responsible" panel: RMC officer chain plus the councillor, MLA, MP and Mayor, each
  with Call / WhatsApp (pre-filled with the spot's details) when a number is known. Bottom bar: **Verify cleanup** (photo from the spot)
  and **Flag as incorrect**.
- **Representative pages** `/rep/mla-hatia`, `/rep/mp-ranchi`, `/rep/mayor`, ...: active dumps, total reports, average wait, wards
  covered, worst wards and recent reports. **Ward pages** show the same for the councillor. **Rankings** list every representative.
- Data: `representatives` and `officerChain` in `data/wards.json`; each ward's `assembly` links it to an MLA (still a draft, see DATA_TODO.md).

## Optional: sending complaints to officials (off)

The code below is kept but **disabled** (`NOTIFY_MODE=off`, the default). Only switch it on if RMC agrees to receive complaints this way.

### How a complaint travels (if enabled)

1. **Reported**: a citizen sends a photo + GPS. The ward is detected automatically.
2. **Verified**: `VERIFY_CONFIRMATIONS` (default 1) *other* people tap "I see this too". Each must share their location within 250 m of the spot, and each person (hashed IP) counts once. An admin can also "Verify now".
3. **Sent to officials** (on verification, if `NOTIFY_MODE` allows):
   - **Email to RMC** (`RMC_EMAIL`) with the photo attached, ward, Google Maps link and the public report link.
   - **The ward councillor**: an email if `councillorEmail` is set for the ward in `data/wards.json`, otherwise an **SMS** to `councillorPhone` (via `SMS_PROVIDER`). Only if that ward is `verified: true` (or `NOTIFY_UNVERIFIED_CONTACTS=true`).
   - If the reporter gave an email, they are **CC'd** on both complaint emails, so they can follow up with officials directly.
   Every delivery is logged (`notifications` table), shown on the report page and in `/admin`, and retried up to 5 times (admin "Retry sending").
   Citizens can always send it themselves too: "WhatsApp the councillor" / "Email RMC" open a ready-made message.
4. **Escalation while it stays uncleared** (days since it was sent; checked every 5 minutes on the server; each step once):

   | Day | Step | Sent to |
   |---|---|---|
   | 3 | Reminder 1 | RMC + ward councillor |
   | 7 | Reminder 2 | RMC + ward councillor |
   | 15 | Escalation | Municipal Commissioner |
   | 21 | Reminder 3 | RMC + ward councillor + Municipal Commissioner |
   | 30 | Escalation | SDO + Deputy Commissioner (DC) |

   Senior officials' contacts live in `data/wards.json` under `"escalation"` (email preferred, else SMS to the phone; `verified: true` required). A step whose contact is missing is logged as skipped. If several steps are overdue at once, only the latest is sent. Acknowledged reports keep escalating until cleared. The schedule is `ESCALATION_STEPS` in `src/lib/constants.ts`.
5. **Acknowledged / Cleared**: an admin marks it, or a citizen *at the spot* posts an "It is clean now" photo. If 2 people nearby say "Still dirty", it reopens.

Each step is timestamped (`events` table), so the report page shows how long every stage took, and the rankings show average days to clear and **response time** (verified to first official action) per ward and zone.

## Telling reporters their spot was cleared

The report form asks for a **mobile number or email (at least one is required)**. It is stored privately with the report, never shown on public pages or in the API, and used once: when the spot is marked cleared (by an admin, or by a citizen's "It is clean now" photo), the reporter gets an email and/or SMS with the report link.

This is controlled by `REPORTER_NOTIFY_MODE` (`off` / `dry-run` / `live`), separately from `NOTIFY_MODE`, so you can tell reporters without sending anything to officials.

- **Email** uses the same `SMTP_*` and `MAIL_FROM` settings as complaints.
- **SMS**: set `SMS_PROVIDER` to `fast2sms` (`FAST2SMS_API_KEY`, uses the "Quick SMS" route, simplest for Indian numbers) or `twilio` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`). Indian carriers require DLT registration for most business SMS; check your provider's rules.

Deliveries show in `/admin` as "reporter email" / "reporter sms" and are retried like complaints.

## Going live

1. **Data**: check `data/wards.json` and `DATA_TODO.md`. Set `verified: true` on each ward whose councillor contact you have confirmed, because only those are contacted. Add `"councillorEmail"` to a ward to email that councillor instead of sending an SMS.
2. **Email**: create an SMTP account (e.g. Gmail with an app password, Zoho Mail, Brevo, Amazon SES) and fill `SMTP_*`, `MAIL_FROM`. Use a domain you own for `MAIL_FROM` so mail is not marked as spam.
3. **SMS**: set `SMS_PROVIDER` and its keys (see "Telling reporters their spot was cleared"). Councillors without an email get the complaint by SMS.
4. Set `NOTIFY_MODE=dry-run`, deploy, file one test report, confirm it from a second phone, and check `/admin` and the server log. Then switch to `NOTIFY_MODE=live`.
5. Set `NEXT_PUBLIC_SITE_URL` to the public https address, because links in messages use it.
6. Consider telling RMC and the councillors before going live, so the messages are expected and not mistaken for spam.

## Deploying (Railway)

The app runs as one long-lived server with a persistent volume for the SQLite database and photos. The repo includes a `Dockerfile` and `railway.json` (health check on `/api/health`, restart on failure).

1. On [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** → pick this repo. Railway builds the `Dockerfile`.
2. In the service, **add a Volume** with mount path **`/data`**. The image already points `DATABASE_PATH=/data/safai.db` and `UPLOAD_DIR=/data/uploads` there.
3. **Settings → Networking → Generate Domain** (or add your own domain). Railway serves it over HTTPS, which geolocation, the camera and the service worker need.
4. **Variables**: at least `ADMIN_PASSWORD` (12+ chars), `IP_HASH_SALT` (long random string) and `NEXT_PUBLIC_SITE_URL` (the https address from step 3; it is baked in at build time, so redeploy after changing it). Then the message settings you want: `REPORTER_NOTIFY_MODE`, `SMTP_*`, `MAIL_FROM`, `SMS_PROVIDER` + keys, and `NOTIFY_MODE` for officials.
5. Deploy. The log warns at startup about any of the required variables that are missing.

What runs in the background on the server (`src/instrumentation.ts`, `src/lib/maintenance.ts`), every 5 minutes:
- retries any email or SMS that is pending or failed (up to 5 attempts),
- writes a daily database snapshot to `/data/backups` and keeps the newest 7,
- clears expired rate-limit rows.

On shutdown the database is flushed and closed cleanly.

**Keep it to one instance** (SQLite has a single writer, and a Railway volume attaches to one replica). Snapshots live on the same volume, so also turn on Railway's volume backups, or copy `/data/backups` elsewhere now and then. Never run `npm run seed:demo` in production.

Rate limits and "one vote per person" use the client IP that the proxy appends to `X-Forwarded-For` (`TRUSTED_PROXY_HOPS`, default 1), so a faked header cannot dodge them.

To try the production image locally: `podman build -t safairanchi . && podman run -p 3000:3000 -v ./data-local:/data:Z -e ADMIN_PASSWORD=... safairanchi` (or `docker`).

**Vercel** is not supported for real use: its filesystem is temporary, so reports and photos would be lost. A Vercel build still starts (data goes to `/tmp`), which is only good for a preview.

## Status

**Done and tested end to end** (headless Chromium, Pixel 7 profile, plus API calls): photo → GPS → submit in 2 taps after the photo; duplicate prompt and upvote; ward auto-detect with manual override; denied-GPS pin fallback; map/list/filters; report page with timeline; admin acknowledge/clear with after-photo; before/after view; EXIF stripping; rate limit, auth and validation errors; Hindi toggle; production build.

**Stubbed / limited**
- `S3Storage` is not implemented.
- Email needs an SMTP account and SMS an SMS provider account. Until configured, verified reports are only logged (`NOTIFY_MODE`).
- Location checks for confirming / cleaning use the phone's reported GPS, which a determined person can fake. Combined with one-vote-per-IP and rate limits this stops casual abuse, not organised fraud.
- Ward detection is nearest *approximate* centroid unless you add boundaries.
- Public tracker loads all reports (cap 2000) client-side, with no clustering or pagination.
- No offline report queue (reports need a connection). No push notifications. Reporters get one email/SMS when their spot is cleared (if `REPORTER_NOTIFY_MODE` is on).
- Rate limits are per salted IP hash, so users behind one carrier NAT share a bucket.
- Admin is a single shared password with a 12 h cookie.
- Demo photos are synthetic illustrations, not real places.
- Hindi strings were written by me and should be reviewed by a native speaker. Also check the Hindi wording of the unverified-data notices.

**You must verify**: all of `DATA_TODO.md` (councillors, zones, ward names, boundaries, centroids, officials, helpline), and decide on the project name and whether to keep the independence disclaimer.
