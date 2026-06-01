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

## To verify before later slices

- [ ] Zoning layer 450 field names (Phase 2 zoning engine).
- [ ] King County Assessor bulk roll (Slice 2) — periodic download, not a live API.
- [ ] FEMA NFHL, USGS, EPA Envirofacts, WA Ecology/DOH (Slice 3).
- [ ] US Census Geocoder + ACS, NWS, WSDOT (Slice 4).
- [ ] King County permits layer / portal, Recorder, Council agendas, WA Legislature (Slice 5).
