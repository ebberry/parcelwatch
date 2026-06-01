# Spec — Living-area ($/sqft) comparables via the Assessor bulk extracts

Status: **proposed** (not built). Owner: appeals feature. Created 2026-06-01.

## 1. Why

Today's comparable-sales and recommendation engines use **recorded sale price**
and **assessed value**, joined per home (see `lib/sales/service.ts`,
`lib/appeals` `buildRecommendation`). The one missing dimension is **building
size**. A $900k sale of a 3,500 sqft house is not comparable to a $900k sale of
a 1,400 sqft house, but right now we can't tell them apart — King County
publishes **no keyless live feed of living-area square footage**.

The single most persuasive appeal metric — and the one the Assessor and the
Board of Equalization actually use — is **price per square foot of living
area**. Adding it lets us:

- Filter comps to genuinely similar homes (size band, not just same use/lot).
- Show a **$/sqft** column next to each comp's sale price.
- Add a **size-adjusted value indicator** to `buildRecommendation`
  (median comp $/sqft × subject living sqft), which should outrank the raw
  sales median and the per-lot-sqft uniformity screen.
- Explain the subject's own characteristics in the report (beds, baths, year
  built, grade, condition) — useful well beyond appeals.

## 2. Data source (King County Assessor bulk "Real Property" extracts)

The Assessor publishes the full assessment roll as zipped CSVs ("Property data
download"). **Rule #1 — verify every URL/field live before hardcoding; these
have moved before.** Candidate landing pages to confirm:

- `https://info.kingcounty.gov/assessor/datadownload/default.aspx` (historical home of the zips)
- King County GIS Open Data portal (mirrors of the same `EXTR_*` tables)

Files we need (CSV inside per-file `.zip`):

| File | Gives us | Key fields (verify names) |
|------|----------|---------------------------|
| `EXTR_ResBldg`  | residential building characteristics | `Major`, `Minor`, `BldgNbr`, **`SqFtTotLiving`**, `SqFt1stFloor`, `SqFt2ndFloor`, `Bedrooms`, `BathFullCount`, `BathHalfCount`, `YrBuilt`, `YrRenovated`, `Condition`, `BldgGrade`, `Stories` |
| `EXTR_RPSale`   | full sale history (beats the 3-yr live layer) | `Major`, `Minor`, `DocumentDate`, **`SalePrice`**, `SaleInstrument`, **`SaleReason`**, `PropertyType`, `PrincipalUse`, `AFForestLand`, `SaleWarning` |
| `EXTR_Parcel`   | lot + parcel attrs (cross-check) | `Major`, `Minor`, `SqFtLot`, `PropName`, `CurrentZoning` |
| `EXTR_LookUp`   | decode coded values | `LUType`, `LUItem`, `LUDescription` (decode `Condition`, `BldgGrade`, `SaleReason`, `PropertyType`) |

Two bonuses over the live sales layer (`KingCo_PropertyInfo/3`):
- **`SaleReason` / `SaleInstrument` / `SaleWarning`** allow precise
  arm's-length filtering (exclude estate, quitclaim, related-party, etc.) —
  far better than the live layer's coarse `ForestLand/CurrentUseLand` flags.
- **Full history**, not just the last 3 years.

### Join key
PIN (10 digits) = `Major` (6, zero-padded) + `Minor` (4, zero-padded).
A parcel may have multiple `EXTR_ResBldg` rows (multiple structures) — sum
`SqFtTotLiving` per PIN, or keep the primary residence (`BldgNbr=1`); decide on
real data. Condos (`EXTR_CondoUnit`) and multifamily (`EXTR_AptComplex`) are a
later phase — residential SFR first.

## 3. Pipeline (runs in the existing BullMQ worker)

```
download .zip  →  stream-unzip  →  stream-parse CSV (no full-file in memory)
   →  filter to King County rows we care about (Vashon/Island + nearby for now)
   →  upsert into Postgres  →  record source file's posted date as fetchedAt
```

- **Where it runs:** a scheduled worker job (`worker.ts` + a new repeatable
  BullMQ job, e.g. `kc-bulk-refresh`), not the request path. Files are tens of
  MB zipped; parse with a streaming CSV reader.
- **Cadence:** monthly. Characteristics change slowly; the roll is republished
  periodically. Store the file's published date and surface it as the panel's
  freshness (honest-freshness rule — never claim "live").
- **Scope guard:** start by loading only PINs in our service area (filter on
  `Major` ranges covering Vashon/unincorporated SW King County) to keep the
  table small; widen as we add jurisdictions.

## 4. Storage (Drizzle / Postgres)

New tables (names illustrative):

```ts
kc_res_bldg     // pin (pk), sqft_living, year_built, year_renovated,
                // bedrooms, bath_full, bath_half, grade, grade_desc,
                // condition, condition_desc, stories, source_date
kc_rp_sale      // id, pin, sale_date, sale_price, instrument, reason,
                // is_arms_length (derived), property_type, source_date
```

Index both by `pin`. `kc_rp_sale` also by `(pin, sale_date desc)`.
Keep the live `KingCo_PropertyInfo/3` layer as the **fast path / failover** for
recency; the bulk `kc_rp_sale` becomes the authoritative, better-filtered store.

## 5. Wiring into the existing engines

- **Adapter:** `lib/adapters/kingcounty/characteristics.ts` →
  `getCharacteristicsByPins(pins): Map<pin, {sqftLiving, yearBuilt, beds, …}>`
  (reads our Postgres table, not the network).
- **`lib/sales/service.ts`:** `SaleComp` gains `sqftLiving` + `pricePerSqFt`;
  `SaleCompSet` gains `medianPricePerSqFt` and a size band used to tighten comp
  selection (e.g. 0.7×–1.4× subject living area).
- **`lib/appeals` `buildRecommendation`:** add a 4th `ValueIndicator`
  `{ key: "sqft", value: medianPricePerSqFt × subjectSqftLiving }`. New
  preference order for the anchor:
  `recent purchase → size-adjusted sales ($/sqft) → raw sales median → per-lot-sqft`.
  This makes the recommended request value size-aware.
- **Report:** a "Building" panel (beds/baths/year/grade/condition) — independent
  value beyond appeals.

## 6. Provenance, privacy, honesty

- **Provenance:** source = "King County Assessor — Real Property extract
  (EXTR_ResBldg/RPSale)", confidence `confirmed` (authoritative roll), `fetchedAt`
  = the file's published date (NOT the ingest time).
- **Privacy:** `EXTR_RPSale` carries no owner names; some extracts include a
  `Taxpayer` table — **do not ingest any owner-name field** (built-environment
  facts only; RCW 42.56.070(9), see `privacy.md`). Building characteristics are
  property attributes, not person-keyed data — in scope.
- **Honesty:** still not a formal appraisal; $/sqft is a strong screen but
  doesn't capture interior condition, view, or recent remodels beyond what the
  grade/condition codes encode. Keep the existing caveats.

## 7. Risks / edge cases

- **URL/schema drift** (Rule #1) — verify the download page + column names live
  before coding; wrap the parser so a renamed column fails loudly, not silently.
- **Multiple buildings per PIN** — define the sqft rollup explicitly.
- **Missing characteristics** — vacant land, new construction, condos →
  `sqftLiving` null; the $/sqft indicator simply drops out (graceful
  degradation), recommendation falls back to the current anchors.
- **Stale roll vs live sales** — a brand-new sale won't be in the monthly bulk
  yet; keep the live layer for recency and reconcile by `(pin, sale_date)`.
- **File size / memory** — must stream; never `JSON.parse`/load whole CSV.
- **Dev env** — local box has constrained tooling; ingestion is designed to run
  in the deployed worker container, with a small committed fixture for tests.

## 8. Verification checklist (do FIRST, per Rule #1)

- [ ] Confirm the live download URL(s) and that `EXTR_ResBldg.zip` /
      `EXTR_RPSale.zip` exist and are fetchable headless.
- [ ] Confirm column names: `SqFtTotLiving`, `Bedrooms`, `BathFullCount`,
      `YrBuilt`, `BldgGrade`, `Condition`, sale `DocumentDate`/`SalePrice`/`SaleReason`.
- [ ] Decode `BldgGrade`/`Condition`/`SaleReason` via `EXTR_LookUp`.
- [ ] Validate the `Major+Minor → PIN` join on 5–10 known Vashon parcels
      against their eReal Property pages.
- [ ] Pick the arms-length `SaleReason`/`SaleWarning` exclusion set from real values.
- [ ] Record all of the above in `docs/data-sources.md`.

## 9. Phasing & rough effort

1. **Verify + document** sources/fields (Rule #1). ~0.5 day.
2. **Ingestion job** (download→stream-parse→upsert) for `EXTR_ResBldg` +
   `EXTR_RPSale`, Vashon scope, monthly schedule. ~1.5 days.
3. **Adapter + engine wiring** ($/sqft column, size-band comp selection, new
   recommendation indicator). ~1 day.
4. **Report "Building" panel** + provenance/freshness. ~0.5 day.
5. Tests with a committed CSV fixture; verify recommendation shifts sensibly
   when size-adjusted. ~0.5 day.

≈ 4 days. Phase 1–3 deliver the appeal upgrade; 4 is a bonus surface.
