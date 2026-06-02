# Data sources — verified endpoints & field maps

Per Operating Rule #1: verify every external endpoint live before coding against
it. This file records what was confirmed and when. Re-verify before each slice.

---

## King County GIS (ArcGIS Online migration)

**Verified: 2026-05-31.**

King County migrated GIS to a new host. Use the new base; the old one is being retired.

- ✅ **PRIMARY (live):** `https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2` (Parcels).
- 🪦 **Retired fallback:** `https://gisdata.kingcounty.gov/.../OpenDataPortal/property__parcel_address_area/MapServer/1722` — retired 2026-06-01 (now returns a non-JSON redirect). Kept only as insurance if resurrected.
- ArcGIS `currentVersion`: **10.91**. Append `?f=json` to any service/layer URL to inspect.

### ⚠️ gisdata 1722 RETIRED (2026-06-01) → gismaps promoted to primary (2026-06-02)

The former primary, gisdata `property__parcel_address_area/1722`, was **retired**
(it now 302-redirects every `/arcgis/rest/...` call to the homepage; verified
down 2026-06-02). We had built a failover to the `gismaps` host during an earlier
flap, so the live site kept working — but it was paying a dead-primary round-trip
on every lookup. So we **promoted gismaps to primary** and demoted the dead
gisdata layer to insurance.

- Primary layer: `Property/KingCo_PropertyInfo/MapServer/2` (Parcels). Carries
  `PIN`, `ADDR_FULL`, `KCA_ZONING`, `LOTSQFT`, `APPRLNDVAL`, `APPR_IMPR`, etc.
- **Not on gismaps** (surface as "not available"): `LAT`/`LON` (derived from the
  parcel polygon centroid, `outSR=4326`, so hazard/neighborhood panels work),
  `LEGALDESC`, and the tax sub-fields (`KCTP_TAXYR`, `LEVY*`, `TAX_*`, `ACCNT_NUM`).
  → **Restored by the Assessor EXTR ingestion** (`EXTR_Parcel`/`EXTR_RPAcct`) —
  see `docs/specs/living-area-comps.md`.
- Implemented in `parcel.ts` + `comparables.ts` (`queryParcels` / `searchComparables`
  / `getValuationsByPins` try gismaps first, fall back to the dead gisdata layer).
- The lesson the brief warned about: **government endpoints change/retire — never
  hardcode a single host.**

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

### ⭐ FEMA National Risk Index (NRI) — Site Risk panel (shipped 2026-06-02)
- ⛔ **Not in OpenFEMA** (no NRI dataset in the DataSets list — the research doc
  was wrong about this). Use the **ArcGIS feature service** instead.
- ✅ **Live, keyless:** `https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query`.
  Query by `where=TRACTFIPS='<11-digit GEOID>'` — the same tract we derive for
  ACS (`geocodeTract`, now exported from the census adapter).
- **Fields used:** `RISK_SCORE`/`RISK_RATNG`/`RISK_SPCTL` (composite + state
  percentile), `EAL_VALT` (expected annual loss), and per-hazard
  `<CODE>_RISKS`/`<CODE>_RISKR` for the 18 hazards (AVLN, CFLD, CWAV, DRGT,
  ERQK, HAIL, HWAV, HRCN, ISTM, LNDS, LTNG, RFLD, SWND, TRND, TSUN, VLCN, WFIR,
  WNTW). We surface the composite + the hazards rated ≥ "Relatively Moderate".
- Confirmed live for the Vashon tract `53033027702`: composite "Relatively
  Moderate" (84th pct WA), Earthquake "Relatively High", Landslide/Coastal-
  flooding "Relatively Moderate". `lib/adapters/fema/nri.ts`, `lib/risk/service.ts`,
  `components/SiteRiskPanel.tsx`. Honesty: relative modeled national index, labeled
  "not a site-specific assessment". (NRI data current v1.20, Dec 2025.)

### ⭐ Critical areas & geology — point-in-polygon site hazards (shipped 2026-06-02)
Distinct from the NRI's tract-level *relative* index: these are **point-in-polygon
facts with regulatory weight** (a mapped critical area can add setbacks, a
geotechnical study, or clearing limits to a permit). Each source degrades
independently (`Promise.all` + per-source `.catch`); both down → unavailable.
`lib/risk/service.ts#getGeoHazards`, `components/GeoHazardsPanel.tsx`.

- ✅ **King County SensitiveAreas (critical areas) — `identify`, keyless:**
  `https://gismaps.kingcounty.gov/arcgis/rest/services/Environment/KingCo_SensitiveAreas/MapServer/identify`.
  Params: `geometry=<lon>,<lat>`, `geometryType=esriGeometryPoint`, `sr=4326`,
  `layers=all:1,3,4,7,8,9,15,17`, `tolerance=2`, `imageDisplay=256,256,96`,
  `mapExtent=<lon-.01>,<lat-.01>,<lon+.01>,<lat+.01>`, `returnGeometry=false`,
  `f=json`. We map hit `layerId` → hazard name and dedupe (`parseHazardHits`,
  pure/tested): `{1,3:"Landslide hazard area", 4:"Steep slope hazard",
  7:"Erosion hazard", 8:"Seismic hazard area", 9:"Coal mine hazard",
  15:"Channel migration hazard", 17:"Debris flow hazard"}`. Non-hazard layers
  (basin condition, shoreline designations, …) are ignored. Confirmed live for
  Vashon parcel `0221029065`: parcel centroid falls in **Steep slope + Erosion**
  (a point a few m away also hits Landslide — point-in-polygon honesty, no
  invented hits). `lib/adapters/kingcounty/sensitiveAreas.ts`.
- ✅ **WA DNR liquefaction susceptibility — query, keyless:**
  `https://gis.dnr.wa.gov/site3/rest/services/Public_Geology/Ground_Response/MapServer/0/query`.
  Params: `geometry=<lon>,<lat>`, `geometryType=esriGeometryPoint`, `inSR=4326`
  (server reprojects from WA State Plane 2927), `spatialRel=esriSpatialRelIntersects`,
  `outFields=LIQUEFACTION_SUSCEPT`, `returnGeometry=false`, `f=json`. Returns the
  susceptibility class string (e.g. Vashon → "Moderate to high" at the centroid).
  `lib/adapters/wadnr/liquefaction.ts`.
- A mapped **landslide** critical area additionally surfaces in the "What matters
  here" synthesis header (priority 1.6, "may restrict building") — the one
  critical area actionable enough to lead with. `lib/report/summary.ts`.

### USGS Earthquake Catalog
- ✅ Keyless GeoJSON: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=&longitude=&maxradiuskm=&starttime=&minmagnitude=&orderby=time`
- We query 100 km / past 365 days / M2.5+. Feature: `properties.{mag,place,time(ms),url}`, `geometry.coordinates [lon,lat,depthKm]`.
- Distance from parcel computed locally (haversine).

### Deferred within Slice 3 (documented, not silently skipped)
- **EPA Envirofacts** — no clean radius/point query; needs FRS geospatial work.
- **WA Dept of Ecology** (shoreline/critical areas) and **WA DOH** drinking-water (Sentry).

## Appeals feature (verified 2026-05-31; sales added 2026-06-01)

- **Comparable assessments:** layer 1722 distance query — `geometry` (point) +
  `distance` + `units=esriSRUnit_Meter` + `spatialRel=esriSpatialRelIntersects`,
  `where=PREUSE_CODE=<n> AND PRIMARY_ADDR=1 AND APPR_IMPR>0 AND LOTSQFT>0 AND PIN<>'<subject>'`.
  Returns nearby same-use parcels with assessed values + LAT/LON.
  ♻️ **Host failover (2026-06-01):** when gisdata is down, `searchComparables`
  retries the gismaps `KingCo_PropertyInfo/MapServer/2` Parcels layer (same
  attribute fields, no `PRIMARY_ADDR`/`LAT`/`LON` — coords derived from the
  polygon centroid, deduped by PIN). So uniformity evidence survives an outage.
- ⭐ **Comparable SALES (NEW 2026-06-01):** `KingCo_PropertyInfo/MapServer/3`
  ("Property sales in the last 3 years") — real recorded excise sales.
  - Hosts (failover, try in order): `gisdata...` then
    `https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/3/query`.
  - Radius query: point+distance buffer, `where=SalePrice>=25000 AND ForestLand='N'
    AND CurrentUseLand='N' AND NonProfitUse='N'` (drops non-market transfers),
    `orderByFields=SaleDate DESC`, `returnGeometry=true&outSR=4326` (centroid →
    distance + the hazard panels). Subject sale history = same layer `where=PIN='…'`.
  - Fields used: `PIN, address, SaleDate (epoch ms), SalePrice, Property_Type,
    Principal_Use, Property_Class` (improved-vs-land), plus the 3 exclusion flags.
  - 🔒 **Privacy:** this layer ALSO carries `buyername`/`Sellername`/addresses —
    we request NONE of those (built-environment facts only; RCW 42.56.070(9)).
  - ⚠️ **Limitation:** no living-area sqft in any keyless live layer, so sales are
    NOT size/condition-adjusted — surfaced as a market screen, never an appraisal.
    Living-area $/sqft would need the Assessor bulk EXTR_ResBldg (a follow-up).
  - Verified live 2026-06-01: 9 sales within 800 m of the Vashon test parcel,
    prices $495k–$915k, dates 2022–2025.
- 🎯 **Recommendation engine (`buildRecommendation`, 2026-06-01):** turns the
  evidence into a concrete value to request. Anchors on ONE real, cited
  indicator — strongest first: recent purchase → **equity/ratio uniformity** →
  comparable-sales median → per-lot-sqft screen — and never blends them into a
  synthetic AVM. Prefills the petition's opinion-of-value + a first-person
  request sentence.
- ⚖️ **Equity / ratio uniformity (2026-06-01):** a valid appeal **even when the
  home is assessed below its sale price**. Using the per-comp sale+assessment
  join, we compute the subject's assessment-to-sale ratio vs the neighborhood
  median ratio; a gap ≥5 pts implies an inequitable assessment (WA Const. art.
  VII §1; RCW 84.40.0301), with an equitable target = neighborhood ratio ×
  subject sale price. Capped at "moderate" strength (the Board may read the sale
  as below-market). Verified live: parcel 0221029065 (sold $900k, assessed $760k
  = 84% vs neighbors 69%) → recommend reducing to ≈ $621k on equity grounds.
- 🧭 **Stance (encourage broadly, never fabricate):** the tool surfaces every
  colorable basis — value, equity, and owner-known factors (damage, county-record
  errors, site/access problems, unpermitted/functional issues) — and encourages
  filing wherever one exists (it's free and low-risk). It will NOT manufacture a
  case where none exists, and it always discloses that the Board can sustain,
  lower, or rarely raise the value. See `lib/appeals` `OWNER_FACTOR_KEYS`.
- ✅ **Living-area ($/sqft) comps — SHIPPED 2026-06-02.** We ingest the Assessor
  bulk extract `EXTR_ResBldg` (the only source of living-area sqft — no keyless
  live feed) into Postgres (`kc_res_bldg`).
  - **Verified live (Rule #1):** zip at
    `https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip`
    (21 MB; single `EXTR_ResBldg.csv`, ~532k rows, dated 2026-05-29). Columns
    confirmed: `Major`(1) `Minor`(2) `BldgNbr`(3) `BldgGrade`(14)
    `SqFtTotLiving`(22) `Bedrooms`(36) `BathFullCount`(39) `YrBuilt`(44).
    PIN = `Major`+`Minor` (zero-padded 6+4). Primary building (`BldgNbr=1`).
  - **Pipeline:** `lib/ingest/resbldg.ts` (stream-unzip via `fflate`, scan for
    newlines, batch-upsert). The worker runs it on startup + daily; also
    `npm run ingest:resbldg`. Read path: `getBuildingByPins` →
    `lib/adapters/kingcounty/building.ts`.
  - **Wired:** `SaleComp` gains `sqftLiving`/`pricePerSqFt`; `SaleCompSet` gains
    `subjectSqftLiving`/`medianPricePerSqFt`/`subjectValueBySqFt`; a new `sqft`
    value indicator (median comp $/sqft × subject sqft) ranks just under a recent
    purchase in `buildRecommendation`. Degrades to non-size-adjusted if the table
    isn't ingested. (`EXTR_Parcel`/`EXTR_RPAcct` for legal-desc/tax restoration:
    still a follow-up.)
- **eAppeals portal (file online, owner login):** `https://blue.kingcounty.gov/assessor/eappeals/RPLookup.aspx` (200 OK).
- **BOE petition forms (mail filing):** `https://kingcounty.gov/en/independents/governance-and-leadership/government-oversight/board-appeals-equalization/appeals-forms` (200 OK).
- Deadline rule (computed): 60 days from value notice or July 1, whichever later.

## Slices 3b + 4 — environment & area context (verified 2026-05-31)

### EPA Facility Registry Service (regulated sites) — ✅ shipped
- `https://geodata.epa.gov/arcgis/rest/services/OEI/FRS_INTERESTS/MapServer/8/query`
  (layer 8 = all-programs `FACILITY_INTERESTS`). Point+distance buffer.
- Fields: `REGISTRY_ID`, `PRIMARY_NAME`, `PGM_SYS_ACRNM`, `LATITUDE83`, `LONGITUDE83`.
  De-dupe by `REGISTRY_ID` (one row per program). Distances sane (0.1–1.3 km on Vashon).

### WA DOH drinking water — ✅ shipped (the address's serving system)
- **Who serves this address** = the service-area polygon containing the point:
  `.../Drinking_Water_Service_Areas/FeatureServer/0/query` with
  `geometry=lon,lat&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects`.
  Fields: `WS_Name`, `WS_Grp` (A/B), `WS_Type`, `WS_Status`, `Ownership`, `Total_Conn`.
  Confirmed: a Seattle point → "Seattle Public Utilities"; the rural Vashon parcel
  → 0 features (not in any mapped service area — wells / small Group B systems).
- **Not-found fallback:** owner searches the systems layer by name
  (`.../Drinking_Water_Systems/FeatureServer/0/query?where=UPPER(WS_Name) LIKE '%…%'`)
  and picks/enters their supplier; the choice is saved per-parcel in localStorage
  (migrates to the account once auth lands).

### ⭐ King County Public Health — septic vs sewer + OSS records — shipped 2026-06-02
High value on Vashon (mostly septic). The "Systems & services" panel group's first
member. `lib/adapters/kingcounty/septic.ts`, `components/SepticPanel.tsx`.
- ⚠️ **gisdata copy RETIRED** (`OpenDataPortal/utility__septic_onsite_parcel_area`
  → 302 to homepage, same death as layer 1722). **Live successor on gismaps:**
  `https://gismaps.kingcounty.gov/arcgis/rest/services/Utility/KingCo_Septic/MapServer`.
- **Keyed by PIN — we query by PIN, not point** (exact, no centroid drift):
  - **Layer 2 "Wastewater treatment type":** `where=PIN='<pin>'`, `outFields=WastewaterTreatmentType,SewerAgency,ExpSewerAgency`.
    `WastewaterTreatmentType` domain: `on-site sewage system` / `sewer connection`
    / `vacant` / `all other values`. `normalizeTreatment` (pure/tested) → septic |
    sewer | vacant | other | unknown.
  - **Layer 3 "Septic and Group B records":** `where=plibrary.utility.ilinx_orme_septic_doc_parcel.PIN='<pin>'`,
    `outFields=…n_OnlineRME,…n_Sewage,…n_GroupB` (counts of records on file →
    "are there as-builts to retrieve?"). Note the qualified `plibrary.…` field
    names (joined view).
- **Link-out** (verified 200): Public Health "Septic and Group B Records Search"
  instant app `https://www.arcgis.com/apps/instant/sidebar/index.html?appid=6c0bbaa4339c4ffab0c53cfe1f8d3d85`
  — retrieve the actual as-built drawings (behind an Azure APIM proxy, so link out).
- Each layer degrades independently; both down → unavailable; no row = "unknown"
  (valid), not an error. Confirmed live for Vashon parcel `0221029065`: "on-site
  sewage system", 2 septic + 1 Group B records on file.

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

### ⭐ WA Ecology — Tacoma Smelter Plume footprint (soil arsenic) — shipped 2026-06-02
The flagship environmental signal for this market: all of Vashon-Maury sits in
the plume from the former ASARCO smelter (arsenic + lead in surface soil).
`lib/adapters/waecology/smelterPlume.ts`, `lib/risk/service.ts#getSoilContamination`,
`components/SmelterPlumePanel.tsx`.
- ✅ **Footprint POLYGON (layer 1), keyless point-in-polygon:**
  `https://services.arcgis.com/6lCKYNJLvwTXqrmp/arcgis/rest/services/TCP/FeatureServer/1/query`.
  Params: `geometry=<lon>,<lat>`, `geometryType=esriGeometryPoint`, `inSR=4326`
  (server reprojects from WA State Plane 2927 — verified, no row drop),
  `spatialRel=esriSpatialRelIntersects`, `outFields=NAME,MILES_FROM`,
  `returnGeometry=false`, `f=json`.
- **`NAME` = the modeled arsenic band** (verbatim, honest): "Under 20 ppm",
  "20 ppm to 40 ppm", "40.1 ppm to 100 ppm", "Over 100 ppm", plus "Limited Data"
  / "Military Base/State Facility". `classifyPlumeBand` (pure/tested) maps these
  to severity against the published reference levels — **20 ppm = state cleanup
  level, 100 ppm = residential-yard action level**. Above-action surfaces in the
  "What matters here" header (priority 1.7, "free testing available").
- ⚠️ **Use layer 1, NOT layer 0** (cleanup-sites points): layer 0's
  `Latitude`/`Longitude` is the responsible-party address, not the contamination
  area — that's why the earlier point-buffer attempt was unreliable. The polygon
  footprint is the correct geometry.
- Honesty: a *modeled* estimate (distance + wind rose), not a measured soil test
  — the panel says so and points to the free Dirt Alert program. Confirmed live
  for Vashon parcel `0221029065`: "Over 100 ppm", 3.1 mi from the smelter.

## Slice 5 — the watches (verified 2026-05-31)

- ✅ **King County Council (Legistar Web API)** — `https://webapi.legistar.com/v1/kingcounty/matters?$top=N&$orderby=MatterIntroDate desc` (keyless, `Accept: application/json`). Fields: `MatterId`, `MatterFile`, `MatterName`/`MatterTitle`, `MatterTypeName`, `MatterStatusName`, `MatterIntroDate`. Topic-filter on the title. (`/events` gives agendas.) **Built.**
- ✅ **WA Legislature web services** — `https://wslwebservices.leg.wa.gov/legislationservice.asmx/GetLegislationByYear?year=YYYY` (+ `GetLegislation`, `GetLegislationIntroducedSince`), keyless XML. Session runs ~Jan–Apr, so it's quiet out of session. **Next.**
- ⛔ **King County permits** — NO API. Only the Accela Citizen Access portal (interactive) or records request. Deferred.
- ⛔ **King County recorder (title/lien watch)** — NO API. Landmark Web portal; ToS forbids automated access. Deferred (needs a vendor feed / records arrangement).

### ⭐ Parcel change-watches (2026-06-01) — the recurring-value core

A second watch shape alongside the jurisdiction feeds: **per-parcel state diffs**.
For a watched parcel we fetch current state, compare to a per-watch `snapshot`
(jsonb on `watches`), and alert the owner on a real delta. First poll seeds the
baseline silently. Engine: `lib/watches/parcel.ts` (pure diffs are unit-tested);
runs inside `runAllWatches()` → BullMQ worker.

- ✅ **`assessment`** — diff `appraisedTotal` from the parcel adapter (reuses the
  gisdata→gismaps failover). Alert: "Assessed value rose: $680k → $760k (+11.8%)
  … you may be able to appeal." Verified live end-to-end against parcel 0221029065.
- ✅ **`sales`** — diff the set of recorded sale keys (`pin:date:price`) within ~1
  mi (gismaps sales layer 3) against the seen-set; alert per new comparable.
  Verified live (2 new sales surfaced). NOTE: the live layer's coarse arms-length
  filter lets some non-market transfers through (e.g. a $100k partial-interest
  sale) — the bulk `EXTR_RPSale` follow-up (see `docs/specs/living-area-comps.md`)
  adds `SaleReason`/`SaleWarning` filtering.
- ⛔ **permits** — still no API (deferred, above); the engine is extensible for it.
- Privacy: built-environment facts only (assessed values, sales) — never owner names.

### 🤖 AI layer (Claude) — area-aware civic enrichment — 2026-06-01

The first (and only) paid external dependency: the Anthropic Messages API
(`lib/ai/claude.ts`, raw fetch, no SDK; model `claude-haiku-4-5-20251001`).
Gated by `ANTHROPIC_API_KEY` — unset = degrades to the keyword-topic subset
(verified). Verified live: enriched all KC council + Seattle council items.

- **What it does** (`lib/ai/civic.ts`): for each legislation item (county/city
  council + state bill), judges **relevance to the parcel's AREA**
  (`high|medium|low|none` + `scope`) and writes a plain-language **summary** +
  **why-it-matters**. Fixes the keyword false positives — the *City of* Shoreline
  matching the "shoreline" topic, mainland site-specific items, etc.
- **Area-aware (this is what makes cities work):** relevance is judged against
  the parcel's jurisdiction (`lib/watches/area.ts` `resolveArea`), and insights
  are cached per **(item, areaKey)**. So a Seattle ordinance is `high` for a
  Seattle parcel and `none` for a Vashon one — verified live.
- **Grounding (trust):** prompt forbids outside knowledge / invented specifics —
  summarize ONLY the provided Legistar/WSL text. Labeled "AI summary", distinct
  from the authoritative source; official link always present.
- **Cost control:** small model (Haiku); cached in Postgres (`ai_summaries`, PK
  `(external_id, area_key)`, content-hashed). WORKER enriches; request path only
  READS the cache — no AI call/cost on a page view.
- **No more keyword gate:** the feed now returns ALL recent matters and the AI
  decides relevance (keyword topics like "vashon" never matched a Seattle item).
  Topics survive only as display pills + topic-scoped watches.
- Uses `WatchItem.fullText` (the legal `MatterTitle`) for the location specifics.

### 🏙️ Generic Legistar adapter (cities) — 2026-06-01

`lib/watches/sources/legistar.ts` — King County and many WA cities run on
Legistar with the identical shape, so one adapter parameterized by client slug
covers them all (`https://webapi.legistar.com/v1/<client>/matters`). **Verified
live (Rule #1):** `kingcounty`, `seattle`, `bellevue`, `redmond` → 200;
`kent`/`renton`/`kirkland` → 500 (not on Legistar). `resolveArea` maps a parcel's
city to its council(s): unincorporated/Vashon → county only; a Legistar city →
city + county. `getCivicActivity(area)` merges the area's councils + WA bills,
enriches per area, drops `none`, sorts by relevance.

Infra: native Homebrew **Postgres 16** + **Redis** (background services); watch state in
Postgres (`watches` incl. `snapshot`, `watch_seen`, `alerts`); **BullMQ** scheduler (`npm run worker`).

## To verify before later slices

- [ ] WA Legislature: in-session incremental polling (GetLegislationIntroducedSince) + per-bill titles.
- [x] WA Ecology — Tacoma Smelter Plume footprint (soil arsenic) shipped 2026-06-02 via the polygon layer (point-in-polygon, inSR=4326). See the Slice 3b section above. (Cleanup-sites *points* remain deferred — wrong geometry.)
- [x] King County real-property **sales** for sale-based comps — ✅ live via
      `KingCo_PropertyInfo/MapServer/3` (last 3 years). Bulk EXTR_ResBldg still a
      follow-up for living-area $/sqft (size-adjusted comps).
- [ ] EPA FRS geospatial endpoint + WA Ecology/DOH (Slice 3b).
- [ ] Urban R-zone dimensional standards (when extending the zoning engine).
- [ ] Zoning layer 450 field names (authoritative-zoning cross-check).
- [ ] King County Assessor bulk roll — periodic download for full sale history.
- [ ] FEMA NFHL, USGS, EPA Envirofacts, WA Ecology/DOH (Slice 3).
- [ ] US Census Geocoder + ACS, NWS, WSDOT (Slice 4).
- [ ] King County permits layer / portal, Recorder, Council agendas, WA Legislature (Slice 5).
