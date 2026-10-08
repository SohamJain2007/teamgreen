# DATA_TODO: what you need to verify or fill in

Everything in `data/wards.json` is marked `"verified": false`. The app shows a "Data not yet verified" badge next to every
official until you flip that flag. **Nothing below has been checked by a human.**

## What was actually fetched (2026-10-08)

| Data | Source | Notes |
|---|---|---|
| Zone for each of 53 wards, plus locality name | https://smartranchi.in/Portal/View/ZonewiseWardList.aspx | Fetched and parsed. |
| 53 ward councillor names + phones, Mayor, Deputy Mayor | https://www.ranchimunicipal.com/docs/ElectedRepresentative.pdf | **The PDF is titled "Important Telephone Number" and is undated.** It may predate the 2026 election. |
| "Administrator" Sushant Gaurav IAS | ranchimunicipal.com home page | See conflict below. |
| RMC helpline 1800-570-1235 | ranchimunicipal.com home page | |

## Conflicts you must resolve

1. **Zone numbering differs from what you gave me.** You assumed West 1-12, North 13-26, South 27-39, East 40-53. The official
   Smart Ranchi portal says:
   - West: 1, 25-36
   - North: 2-12, 18, 19, 47
   - South: 13-17, 20-24, 45, 46
   - East: 37-44, 48-53

   I used the portal's version (it is official, and the totals are 53). Please confirm it matches your reading of RMC records.
2. **Elected body vs "Administrator".** The RMC home page lists an Administrator, Additional Administrator and Deputy Administrator, while the PDF lists a Mayor and 53 councillors. One of them is stale. Confirm who currently holds office.
3. **53 vs 55 wards.** Wards 54 and 55 exist in `wards.json` as `placeholder: true` entries (hidden from the app). When confirmed, fill in `zone`, `name`, councillor and remove `placeholder`. If the ward count changed, **every ward's zone, number and boundary may have changed too**, not just 54 and 55.
4. Deputy Mayor "Shri Neeraj Kumar" and the Ward 31 councillor share the same name and phone in the PDF (plausible: the Deputy Mayor is also a councillor), but confirm.

## Still to fill in / verify

- [ ] **Ward boundaries.** Not found. Add `data/ward-boundaries.geojson` (FeatureCollection, each feature with `properties.wardNumber` and a Polygon/MultiPolygon). Until then ward detection uses nearest centroid.
- [ ] **Ward centroids (`lat`/`lng`).** Approximate: I geocoded the *locality name* via OpenStreetMap Nominatim. Known problems:
  - Several wards share a locality (e.g. 3 and 4 Babutoli, 15 and 16 Konka, 39 and 40 Ambatoli, 43 and 44 Naditoli, 51 and 52 Hatia), so they have **identical centroids** and ties go to the lower number.
  - Some geocodes look wrong: ward 19 Karamtoli (23.30, 85.36), 26 Tongritoli and 31 Hesal (lng ~85.47), 29 Mahuatoli, 33/35 Tangratoli. Check against a map.
  - Ward 23 has no locality and no centroid, so it is never auto-detected (still selectable manually).
  Ward detection is advertised as approximate in the UI ("please confirm") while on centroid mode.
- [ ] **Ward names.** `name` is the locality from the portal's address line, not an official ward name. Replace with the official names.
- [ ] **Councillors.** Verify each name and phone against a current, dated source, then set `verified: true` per ward. Some councillors have two numbers (`/`-separated).
- [ ] **Mayor, Deputy Mayor, Municipal Commissioner** (`rmcOfficials` in `wards.json`).
- [ ] **RMC Health / Sanitation officer contacts.** Not found; `healthOfficer` is `null`. Ideally add zonal sanitation officers/inspectors per zone and a per-ward sanitary inspector (this needs a schema addition if you want it shown per ward).
- [ ] **RMC grievance channels.** The app does *not* forward reports to RMC. If RMC has an API/email/WhatsApp intake, an integration is the biggest remaining accountability win.
- [ ] Confirm the **helpline** number and email still work.
