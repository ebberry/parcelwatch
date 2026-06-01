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

## Slice 3 — hazards & environment (verified 2026-05-31)

### FEMA National Flood Hazard Layer (NFHL)
- ⛔ **Dead path:** `hazards.fema.gov/gis/nfhl/rest/...` (404).
- ✅ **Live:** `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` (currentVersion 11.1).
- **Layer 28** = "Flood Hazard Zones". Point query (geometryType=esriGeometryPoint, inSR=4326, spatialRelIntersects).
- Fields used: `FLD_ZONE`, `ZONE_SUBTY`, `SFHA_TF` (T/F), `STATIC_BFE`, `DFIRM_ID`.
- ⚠️ `STATIC_BFE = -9999` is a "no BFE" sentinel → normalize to null. `FIRM_PAN` is NOT on layer 28 (caused a 400).
- Confirmed: inland Vashon → Zone X (SFHA F); near-shore → Zone VE (SFHA T, BFE 15 ft).

### USGS Earthquake Catalog
- ✅ Keyless GeoJSON: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=&longitude=&maxradiuskm=&starttime=&minmagnitude=&orderby=time`
- We query 100 km / past 365 days / M2.5+. Feature: `properties.{mag,place,time(ms),url}`, `geometry.coordinates [lon,lat,depthKm]`.
- Distance from parcel computed locally (haversine).

### Deferred within Slice 3 (documented, not silently skipped)
- **EPA Envirofacts** — no clean radius/point query; needs FRS geospatial work.
- **WA Dept of Ecology** (shoreline/critical areas) and **WA DOH** drinking-water (Sentry).

## Appeals feature (verified 2026-05-31)

- **Comparable assessments:** layer 1722 distance query — `geometry` (point) +
  `distance` + `units=esriSRUnit_Meter` + `spatialRel=esriSpatialRelIntersects`,
  `where=PREUSE_CODE=<n> AND PRIMARY_ADDR=1 AND APPR_IMPR>0 AND LOTSQFT>0 AND PIN<>'<subject>'`.
  Returns nearby same-use parcels with assessed values + LAT/LON. (Not sales —
  no live KC sales API; that's a bulk-roll follow-up.)
- **eAppeals portal (file online, owner login):** `https://blue.kingcounty.gov/assessor/eappeals/RPLookup.aspx` (200 OK).
- **BOE petition forms (mail filing):** `https://kingcounty.gov/en/independents/governance-and-leadership/government-oversight/board-appeals-equalization/appeals-forms` (200 OK).
- Deadline rule (computed): 60 days from value notice or July 1, whichever later.

## Slices 3b + 4 — environment & area context (verified 2026-05-31)

### EPA Facility Registry Service (regulated sites) — ✅ shipped
- `https://geodata.epa.gov/arcgis/rest/services/OEI/FRS_INTERESTS/MapServer/8/query`
  (layer 8 = all-programs `FACILITY_INTERESTS`). Point+distance buffer.
- Fields: `REGISTRY_ID`, `PRIMARY_NAME`, `PGM_SYS_ACRNM`, `LATITUDE83`, `LONGITUDE83`.
  De-dupe by `REGISTRY_ID` (one row per program). Distances sane (0.1–1.3 km on Vashon).

### WA DOH drinking-water systems — ✅ shipped
- `https://services8.arcgis.com/rGGrs6HCnw87OFOT/arcgis/rest/services/Drinking_Water_Systems/FeatureServer/0/query`
- Fields: `WS_Name`, `WS_Grp` (A/B), `WS_Status`. No lat/lon fields → read geometry (outSR=4326).

### NWS active weather alerts — ⛔ DROPPED (product fit)
- Verified working (`https://api.weather.gov/alerts/active?point=<lat>,<lon>`, needs a
  User-Agent header) but removed: live weather is a real-time utility that doesn't fit
  ParcelWatch's deep, durable property-research character. Adapter removed.

### U.S. Census ACS — ✅ shipped (verified live with key)
- Geocoder (KEYLESS, verified): `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?...` → tract (e.g. 53033027702).
- ACS 5-year (2023): `https://api.census.gov/data/2023/acs/acs5?get=...&for=tract:...&in=state:53%20county:033&key=CENSUS_API_KEY`.
  Keyless access retired → needs a free key (in `.env`, gitignored). Verified live: tract
  277.02 → pop 4,825, median income $125,587, median home value $763,100, 82% owner-occupied.
  Vars: B01003_001E (pop), B19013_001E (income), B25077_001E (home value), B25003_001E/002E (tenure).

### ⛔ WA Ecology TCP CleanupSites — DEFERRED (unreliable spatial filter)
- `services.arcgis.com/6lCKYNJLvwTXqrmp/.../TCP/FeatureServer/0` returns sites far
  outside the buffer; `Latitude`/`Longitude` = responsible-party location, not the
  contamination footprint; geometry is State Plane (wkid 2927) and reprojection
  to 4326 drops rows. Needs footprint/proj handling before it's trustworthy.

## Slice 5 — the watches (verified 2026-05-31)

- ✅ **King County Council (Legistar Web API)** — `https://webapi.legistar.com/v1/kingcounty/matters?$top=N&$orderby=MatterIntroDate desc` (keyless, `Accept: application/json`). Fields: `MatterId`, `MatterFile`, `MatterName`/`MatterTitle`, `MatterTypeName`, `MatterStatusName`, `MatterIntroDate`. Topic-filter on the title. (`/events` gives agendas.) **Built.**
- ✅ **WA Legislature web services** — `https://wslwebservices.leg.wa.gov/legislationservice.asmx/GetLegislationByYear?year=YYYY` (+ `GetLegislation`, `GetLegislationIntroducedSince`), keyless XML. Session runs ~Jan–Apr, so it's quiet out of session. **Next.**
- ⛔ **King County permits** — NO API. Only the Accela Citizen Access portal (interactive) or records request. Deferred.
- ⛔ **King County recorder (title/lien watch)** — NO API. Landmark Web portal; ToS forbids automated access. Deferred (needs a vendor feed / records arrangement).

Infra: native Homebrew **Postgres 16** + **Redis** (background services); watch state in
Postgres (`watches`, `watch_seen`, `alerts`); **BullMQ** scheduler (`npm run worker`).

## To verify before later slices

- [ ] WA Legislature: in-session incremental polling (GetLegislationIntroducedSince) + per-bill titles.
- [ ] WA Ecology cleanup sites — proper footprint + projection handling (Tacoma Smelter Plume affects Vashon).
- [ ] King County real-property **sales** source (bulk EXTR_RPSale) for sale-based comps.
- [ ] EPA FRS geospatial endpoint + WA Ecology/DOH (Slice 3b).
- [ ] Urban R-zone dimensional standards (when extending the zoning engine).
- [ ] Zoning layer 450 field names (authoritative-zoning cross-check).
- [ ] King County Assessor bulk roll — periodic download for full sale history.
- [ ] FEMA NFHL, USGS, EPA Envirofacts, WA Ecology/DOH (Slice 3).
- [ ] US Census Geocoder + ACS, NWS, WSDOT (Slice 4).
- [ ] King County permits layer / portal, Recorder, Council agendas, WA Legislature (Slice 5).
