# Data sources — verified endpoints & field maps

Per Operating Rule #1: verify every external endpoint live before coding against
it. This file records what was confirmed and when. Re-verify before each slice.

---

## King County GIS (ArcGIS Online migration)

**Verified: 2026-05-31.**

King County migrated GIS to a new host. Use the new base; the old one is being retired.

- ✅ **Current base:** `https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/`
- ⛔ **Deprecated:** `https://gismaps.kingcounty.gov/arcgis/rest/services/...` (do not use)
- ArcGIS `currentVersion`: **10.91**. Append `?f=json` to any service/layer URL to inspect.

### ⭐ Slice 1 anchor — `property__parcel_address_area` (MapServer), layer **1722**

A **denormalized layer** that joins parcel geometry + address + assessor
attributes in one place. This is the primary Slice 1 source — one query yields
everything the baseline report needs, plus a head start on Slice 2 (tax).

- **Layer URL:** `.../OpenDataPortal/property__parcel_address_area/MapServer/1722`
- **Geometry:** `esriGeometryPolygon` · **maxRecordCount:** `2000` · query formats: JSON, geoJSON
- **No owner-name field** present — privacy-clean (see [privacy.md](./privacy.md)).

**Fields we use (verbatim names):**

| Purpose | Field | Type |
| --- | --- | --- |
| Parcel id (PIN) | `PIN` (also `MAJOR`, `MINOR`) | string |
| Full street address | `ADDR_FULL` (+ components `ADDR_HN`/`ADDR_SN`/`ADDR_ST`…) | string |
| City / ZIP | `POSTALCTYNAME`, `CTYNAME`, `ZIP5` | string |
| Geocode anchor | `LAT`, `LON` (also `POINT_X/Y`) | double |
| Lot size | `LOTSQFT`, `KCA_ACRES` | int / double |
| Zoning (assessor's copy) | `KCA_ZONING` | string |
| Present use | `PREUSE_CODE`, `PREUSE_DESC` | smallint / string |
| Property type | `PROPTYPE`, `LEGALDESC` | string |
| Tax head-start (Slice 2) | `APPRLNDVAL`, `APPR_IMPR`, `TAX_LNDVAL`, `TAX_IMPR`, `LEVYCODE`, `LEVY_JURIS`, `KCTP_TAXYR` | double / string |
| Primary-address flag | `PRIMARY_ADDR` (1 = primary) | smallint |

**Caveats:**
- A parcel (PIN) can have **multiple address rows**. Dedupe by `PIN`, prefer
  `PRIMARY_ADDR = 1`.
- `KCA_ZONING` is the **Assessor's** zoning copy. For an authoritative zoning
  answer in the Phase 2 zoning engine, cross-check against the planning zoning
  layer (450, below) by spatial intersect. For Slice 1, surface `KCA_ZONING`
  with provenance = "King County Assessor (parcel-address layer)".
- Queries can hit `exceededTransferLimit: true` — page with `resultOffset` /
  `resultRecordCount` (≤ 2000).

**Confirmed live query (2026-05-31):**
```
GET .../property__parcel_address_area/MapServer/1722/query
  ?where=POSTALCTYNAME='VASHON'
  &outFields=PIN,ADDR_FULL,POSTALCTYNAME,ZIP5,KCA_ZONING,PREUSE_CODE,PREUSE_DESC,LOTSQFT,KCA_ACRES,LAT,LON,PRIMARY_ADDR
  &returnGeometry=false&resultRecordCount=3&orderByFields=PIN&f=json
```
→ 200 OK, 3 features. Sample: PIN `0121029008`, "12825 SW BACHELOR RD", Vashon
98070, `KCA_ZONING=RA-2.5`, present-use "Single Family", 1.01 acres, with LAT/LON.
(Rural-area zoning codes are consistent with Vashon — sanity-checked.)
Save a full raw response as a fixture under `/tests` when building the adapter.

### Parcel geometry layer — `property__parcel_area` (FeatureServer), layer **439**

- **Layer URL:** `.../OpenDataPortal/property__parcel_area/FeatureServer/439`
- Geometry `esriGeometryPolygon` · **maxRecordCount 4000** · capabilities `Query,Extract`
- **Fields:** `OBJECTID`, `MAJOR`, `MINOR`, `PIN`, `Shape__Length`, `Shape__Area` — **geometry + PIN only**. No zoning/use/lot/address here.
- ⚠️ The layer id is **439, not 0** (querying `/0` returns HTTP 500).
- Use this when you need authoritative parcel **geometry** by PIN (e.g. PostGIS
  ingest, radius queries). For attributes, prefer layer 1722 above.

### Zoning polygons — `planning__zoning_area` (MapServer), layer **450**

- Geometry `esriGeometryPolygon` · maxRecordCount 1000 · JSON/geoJSON.
- Authoritative **planning** zoning (vs the Assessor's `KCA_ZONING`). For the
  Phase 2 zoning engine: spatial-intersect the parcel point with this layer.
- Field names not yet pulled — verify the zoning-code field before Phase 2.

### ⚠️ Trap — `property__realprop_area` (MapServer), layer **1289**

- Despite the promising name, this is **"Parcels owned by King County"**
  (county-owned property only), **not** the general assessor roll. Do **not**
  use it as the general attribute source. Layer 1722 is the right anchor.

---

## Slice 2 — tax & assessment (verified 2026-05-31)

- **Valuation fields** (live, from layer 1722, same row as parcel core):
  `APPRLNDVAL`, `APPR_IMPR`, `TAX_LNDVAL`, `TAX_IMPR`, `LEVYCODE`, `LEVY_JURIS`,
  `KCTP_TAXYR`, `ACCNT_NUM`. Confirmed sample (PIN 0121029008): land $414,000 +
  improvements $658,000 = $1,072,000, TY 2026, levy 4045 "KING COUNTY", acct
  012102900805. Matches the county's eReal Property page.
- **Official record deep-link** (verified loads):
  `https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=<PIN>`
  — carries live tax bill, tax-roll history, and sales. ⚠️ This county page
  displays owner names; we deep-link only (no scraping, no republishing).
- **Tax-payment portal:** `https://payment.kingcounty.gov/Home/Index?app=PropertyTaxes`
  (generic landing; not parcel-parameterized — we link via eReal Property instead).
- **Deadlines are computed, not fetched:** Apr 30 / Oct 31 (RCW 84.56.020),
  BOE appeal July 1 floor (RCW 84.40.038). See `lib/tax/deadlines.ts`.
- **Bulk assessor roll** (full sale history / authoritative roll) — still a
  later scheduled-ingest task; the GIS layer is the live snapshot for now.

## Zoning engine — King County Code (verified 2026-05-31)

⚠️ **The 2024 reorganization (Ord. 19881) repealed KCC 21A.12.030.** Rural-area
dimensional standards moved to **KCC 21A.09T.030**. Verified against the current
clerk code + the March 2026 ADU permit sheet. Cite the current sections:

| Topic | Current KCC section | Verified values (RA zones) |
| --- | --- | --- |
| Density / dimensions | **21A.09T.030** | min lot 1.875 / 3.75 / 7.5 / 15 ac (RA-2.5/5/10/20); base height 40 ft; street setback 30 ft; interior 5 ft (RA-2.5) / 10 ft |
| Accessory dwelling unit | **21A.08.030.B.7** | 1 ADU/lot rural; detached only if lot ≥ min lot area; ≤1,000 sf heated + 1,000 sf unheated; prohibited in Forest (F) zone; notice on title |
| Home occupation (RA) | **21A.30.085** | ≤20% of home floor area; ≤3 on-site non-resident employees; limited hours |
| Home occupation (R/UR) | 21A.30.080 | (urban — not yet encoded) |

- Engine scope: **RA zones only**; other zones return "check with county."
- Base density (du/ac) figures intentionally NOT shown (counterintuitive; we use
  min lot area for subdivision logic instead). See `/lib/zoning`.
- **Still unverified:** R (urban residential) zone height/setbacks (separate
  geography chapter); zoning layer 450 field names (for authoritative-zoning
  cross-check vs the Assessor's `KCA_ZONING`).

## To verify before later slices

- [ ] Urban R-zone dimensional standards (when extending the zoning engine).
- [ ] Zoning layer 450 field names (authoritative-zoning cross-check).
- [ ] King County Assessor bulk roll — periodic download for full sale history.
- [ ] FEMA NFHL, USGS, EPA Envirofacts, WA Ecology/DOH (Slice 3).
- [ ] US Census Geocoder + ACS, NWS, WSDOT (Slice 4).
- [ ] King County permits layer / portal, Recorder, Council agendas, WA Legislature (Slice 5).
