# DATA_TODO: what you need to verify or fill in

> **2026-10-09:** the project owner confirmed the 2026 ward list (councillors, phones, areas), the Mayor/Deputy Mayor/Commissioner
> entries and the helpline, so all of those are now `verified: true`. Items below about councillors/zones are kept for history.

## Still open: which ward belongs to which MLA (DRAFT)

`representatives` in `data/wards.json` lists the MP (Sanjay Seth, BJP, Ranchi Lok Sabha) and the four MLAs whose seats cover the
city: Ranchi (C. P. Singh, BJP), Hatia (Navin Jaiswal, BJP), Kanke SC (Suresh Kumar Baitha, INC), Khijri ST (Rajesh Kachhap, INC),
from Wikipedia's Ranchi Lok Sabha page and 2024 assembly results. **Each ward's `assembly` field was assigned by me from its area
name, not from an official list**, so MLA panels show "not yet verified" until you fix it:

- Kanke: 1, 2, 3, 27, 30, 32, 34
- Khijri: 4, 5, 6, 7, 9, 13
- Hatia: 24, 25, 29, 33, 35-53
- Ranchi: every other ward (8, 10-12, 14-23, 26, 28, 31)

Correct the `assembly` values (`mla-ranchi`, `mla-hatia`, `mla-kanke`, `mla-khijri`), add MLA/MP office phone numbers if you want
"Call / WhatsApp" on their cards, then set `representatives.assemblyMappingVerified` to `true`.
RMC officer names (`officerChain`) are roles only; add names when known.

Everything in `data/wards.json` is marked `"verified": false`. The app shows a "Data not yet verified" badge next to every
official until you flip that flag. **Nothing below has been checked by a human.**

## What was actually fetched (2026-10-08)

| Data | Source | Notes |
|---|---|---|
| Zone for each of 53 wards, plus locality name | https://smartranchi.in/Portal/View/ZonewiseWardList.aspx | Fetched and parsed. |
| 53 ward councillor names + phones, Mayor, Deputy Mayor | https://www.ranchimunicipal.com/docs/ElectedRepresentative.pdf | **The PDF is titled "Important Telephone Number" and is undated.** It may predate the 2026 election. |
| "Administrator" Sushant Gaurav IAS | ranchimunicipal.com home page | See conflict below. |
| RMC helpline 1800-570-1235 | ranchimunicipal.com home page | |
| **53 ward councillors, phones and areas (2026)** | `RMC ward member list 2026.xlsx`, provided by the project owner (2026-10-09) | **Now the source for every councillor name, phone and area.** Replaces the undated PDF. |

## Conflicts you must resolve

1. **Zone numbering differs from what you gave me.** You assumed West 1-12, North 13-26, South 27-39, East 40-53. The official
   Smart Ranchi portal says:
   - West: 1, 25-36
   - North: 2-12, 18, 19, 47
   - South: 13-17, 20-24, 45, 46
   - East: 37-44, 48-53

   I used the portal's version (it is official, and the totals are 53). Please confirm it matches your reading of RMC records.
2. **Elected body vs "Administrator".** The RMC home page lists an Administrator, Additional Administrator and Deputy Administrator, while the PDF lists a Mayor and 53 councillors. One of them is stale. Confirm who currently holds office.
3. ~~53 vs 55 wards.~~ **Resolved:** the 2026 list has 53 wards, so placeholders 54 and 55 were removed. However, the 2026 areas differ from the portal's localities for many wards (e.g. ward 1 Pipitoli → Kanke Road Gonda, ward 47 Pahantoli → Doranda), so **the zone assignments (from the older portal list) may be out of date.** Confirm each ward's zone.
4. Deputy Mayor "Shri Neeraj Kumar" and the Ward 31 councillor share the same name and phone in the PDF (plausible: the Deputy Mayor is also a councillor), but confirm.

## Still to fill in / verify

- [ ] **Ward boundaries.** Not found. Add `data/ward-boundaries.geojson` (FeatureCollection, each feature with `properties.wardNumber` and a Polygon/MultiPolygon). Until then ward detection uses nearest centroid.
- [ ] **Ward centroids (`lat`/`lng`).** Re-geocoded on 2026-10-09 from the **2026 area names** via OpenStreetMap Nominatim (each ward's `centroidSource` says which query matched). Still approximate. Known problems:
  - Not found by the geocoder, old centroid kept: wards 8 (Kantatoli), 15 (Karbala Chowk), 20 (Tharpakhna), 36 (Dibadih), 37 (Jagarnathpur).
  - **No centroid** (old one was 16-17 km away, clearly wrong): wards 26 (Tongritoli) and 31 (Hesal). They are never auto-detected; reporters pick them manually.
  - Shared centroids: 22/23 (Hindpiri), 32/39 (Ambatoli), 33/35 (Tangratoli), 38/40 (Dhurwa), 43/45/47 (Doranda).
  - Worth checking on a map: 33/35 Tangratoli and 53 Kumbatoli (~8 km south), 29 Mahuatoli (~6.5 km west).

  Older notes (before the 2026 re-geocode):
  - Several wards share a locality (e.g. 3 and 4 Babutoli, 15 and 16 Konka, 39 and 40 Ambatoli, 43 and 44 Naditoli, 51 and 52 Hatia), so they have **identical centroids** and ties go to the lower number.
  - Some geocodes look wrong: ward 19 Karamtoli (23.30, 85.36), 26 Tongritoli and 31 Hesal (lng ~85.47), 29 Mahuatoli, 33/35 Tangratoli. Check against a map.
  - Ward 23 has no locality and no centroid, so it is never auto-detected (still selectable manually).
  Ward detection is advertised as approximate in the UI ("please confirm") while on centroid mode.
- [ ] **Ward names.** `name` is now a short label I derived from the 2026 `area` text (full text is in `area` and shown on the ward page). Replace with official ward names if RMC has them.
- [ ] **Councillors.** Updated from the 2026 list. Set `verified: true` per ward once you are confident in that list. Notes:
  - **No phone in the 2026 list:** wards 7 (Minu Devi), 20 (Sunil Yadav), 42 (Mamta Soni), 43 (Sashi Singh). Old, possibly stale numbers were dropped.
  - Possible typos in the sheet, kept as-is: ward 52 "Perter Khoya" (Peter?), ward 15/area "Shasrtri Chowk", ward 38 "Durwa" (Dhurwa?).
  - Ward 20 and ward 29 councillors are both "Sunil Yadav" (different phones), which is plausible but worth a check.
  - The Deputy Mayor entry still uses the old PDF; ward 31's 2026 phone (8797050007) matches it.
- [ ] **Mayor, Deputy Mayor, Municipal Commissioner** (`rmcOfficials` in `wards.json`).
- [ ] **RMC Health / Sanitation officer contacts.** Not found; `healthOfficer` is `null`. Ideally add zonal sanitation officers/inspectors per zone and a per-ward sanitary inspector (this needs a schema addition if you want it shown per ward).
- [ ] **RMC grievance channels.** The app does *not* forward reports to RMC. If RMC has an API/email/WhatsApp intake, an integration is the biggest remaining accountability win.
- [ ] Confirm the **helpline** number and email still work.

## Councillor emails (optional)

Complaints reach each ward councillor by **SMS** to `councillorPhone`. If you collect a councillor's email, add
`"councillorEmail": "name@example.com"` to that ward in `data/wards.json` and they get an email (with the photo) instead.

## Escalation contacts (needed for day 15 and day 30 escalations)

Fill `"escalation"` in `data/wards.json`: `commissioner` (Municipal Commissioner, RMC), `sdo` (SDO, Ranchi Sadar) and
`dc` (Deputy Commissioner, Ranchi). Give an official email (preferred) or mobile, then set `verified: true`.
Until then those steps are logged as "skipped" in /admin and nothing is sent to them.
