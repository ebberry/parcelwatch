# Architecture Decision Log

Running log of every non-obvious choice and why. Newest first.

---

## 2026-05-31 — Slices 3b + 4: EPA, WA DOH, NWS, Census (area & environment)

### Generic ArcGIS point-query helper for multi-source fan-out
**Why:** EPA / WA DOH (and others) are all keyless ArcGIS point/radius queries.
`lib/adapters/arcgis.ts` (`queryArcgisNearby`) + a shared `NearbySites`
normalizer (`lib/environment/nearby.ts`) let each source be a thin adapter that
just maps fields → `{name, detail, lat/lon}`. One `<NearbySitesPanel>` renders
any of them.

### Dropped WA Ecology cleanup sites — its spatial filter is unreliable
**Why:** Investigated and rejected (would have shipped misleading "nearby"
data). The TCP CleanupSites layer: (a) returns sites well OUTSIDE the buffer (a
1 km query returned Tacoma sites ~4 km away); (b) its `Latitude`/`Longitude`
fields are the responsible-party/smelter location, not the contamination
footprint (e.g. "WestRock Tacoma" at 9.4 km surfaced for a Vashon point because
the Tacoma Smelter Plume geometry blankets the island); (c) returnGeometry
reprojects to State Plane (wkid 2927) and to WGS84 drops most rows. No
trustworthy distance is derivable without proj4 + footprint logic. Deferred and
documented rather than shipped wrong. (The plume genuinely affects Vashon — a
proper treatment is future work.)

### Per-source coordinate handling (verified each)
**Why:** EPA uses `LATITUDE83`/`LONGITUDE83` fields (sane distances, 0.1–1.3 km
on Vashon). WA DOH has NO lat/lon fields, so we read geometry with outSR=4326
(sane, 0.1–3.0 km). returnGeometry is avoided where a layer has coordinate
fields (it misbehaves on some AGOL services).

### NWS needs a User-Agent header
**Why:** `api.weather.gov` rejects requests without a descriptive User-Agent.
Alerts are keyless GeoJSON; zero alerts → a reassuring green quiet state.

### Census ACS is gated behind a free API key
**Why:** Keyless ACS access was retired (returns `missing_key.html`). The
geocoder (coords→tract) is still keyless and verified. The ACS data adapter is
built to the documented `[[headers],[values]]` format but gated behind
`CENSUS_API_KEY`; with no key the panel shows an honest "add a key" state. ACS
parsing is UNVERIFIED-live until a key is added (flagged in data-sources.md).

---

## 2026-05-31 — Assisted assessed-value appeals (user request)

### Assisted prep + hand-off, never auto-submit
**Why:** King County's Board of Equalization has no submission API; filing is via
the eAppeals portal (owner login) or a mailed petition. Auto-submitting a quasi-
legal filing on someone's behalf raises authorization/agency + portal-ToS +
fragility problems. So we pre-fill the official petition and the owner reviews
and files it themselves (user chose this over full auto-submit). Output is a
print-to-PDF petition + a deep-link to eAppeals — no new PDF dependency.

### Comparable ASSESSMENTS (uniformity), not sales — and honestly labeled
**Why:** There's no clean live King County sales API (only the bulk roll). So the
comp engine uses assessed values of nearby same-use parcels — a single layer-1722
distance query — which is legitimate "uniformity" appeal evidence (the county
assesses similar homes lower than yours). We label it as assessment-comparison,
not sales, and flag that per-lot-sqft is a rough screen (no building size /
condition). Real sale comps remain a bulk-roll follow-up.

### Non-AVM: the owner states their own opinion of value
**Why:** The brief forbids an automated valuation model. We never compute a
suggested value; we show real comp medians as *reference* and the owner enters
their own opinion of value. `buildUniformityNarrative` returns null unless the
data actually supports an over-assessment — we never manufacture a claim. (Live
proof: the Vashon sample is 7% *below* its comp median, and the tool says so
rather than inventing grounds.)

### Comp normalization by lot square foot (documented limitation)
**Why:** Layer 1722 has lot size but not building/living area, so we normalize
assessed value by lot sqft and filter comps to 0.4×–2.5× the subject's lot. It's
a rough uniformity screen, surfaced with that caveat — not a formal appraisal.

---

## 2026-05-31 — Plain-language jargon (user request)

### A glossary + accessible info-tips; decode codes inline
**Why:** The product should read like prose, not a government spreadsheet. Coded
values are decoded inline (PROPTYPE "R" → "Residential (R)"; flood zone shown
with its FEMA subtype). Concept terms (assessed value, levy, SFHA, base flood
elevation, FIRM, setback, min lot area, etc.) carry an accessible `<InfoTip>`
(`/components/InfoTip.tsx`) — a focusable, click/Escape/click-outside affordance
that works on touch (not hover-only), so it's WCAG-friendly and mobile-friendly.

### PROPTYPE codes verified before decoding
**Why:** Never invent meanings. R/K/C/M/T (Residential/Condominium/Commercial/
mineral/Timber) were verified against King County's parcel-extract metadata;
unknown codes fall back to "Other classification" rather than a guess.

### Note: dev hot-reload chunk cache can corrupt after adding client components
**Why:** After adding `<InfoTip>` ("use client"), the running `next dev` threw a
spurious `_document.js` runtime overlay though `tsc` + `next build` were clean.
Fix: stop dev, `rm -rf .next`, restart. (Production build is the source of truth
for "does it actually render.")

---

## 2026-05-31 — Slice 3: hazards & environment (FEMA + USGS)

### Proves the adapter pattern: two new independent sources, zero core changes
**Why:** FEMA flood and USGS quakes became `DataSourceAdapter`s
(`fema.flood`, `usgs.earthquakes`) consumed through the same `runAdapter` +
`SourceCache` + `SourcedValue` plumbing as King County — validating the core
architectural bet (new source = new adapter). Each point/radius-queries off the
parcel's lat/lon, which we already have.

### Scoped to FEMA + USGS; EPA / WA Ecology / WA DOH deferred (honest, not silent)
**Why:** FEMA and USGS are clean keyless point/radius queries. EPA Envirofacts
has no clean radius endpoint and would rabbit-hole; WA Ecology/DOH are more
involved. Per the brief's "build vertical slices, ship quality," we shipped two
solid sources rather than half-implementing five, and documented the deferral in
data-sources.md rather than pretending coverage is complete.

### FEMA endpoint corrected live (Rule #1)
**Why:** The well-known `hazards.fema.gov/gis/nfhl/...` path is dead (404); the
live host is `hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`,
layer 28 = "Flood Hazard Zones". Also: `STATIC_BFE = -9999` is a "no base flood
elevation" sentinel — normalized to null, never shown as a real elevation. A
point with no flood polygon → `mapped: false` ("not in mapped flood data"), an
honest state, not an error.

### USGS raw carries the query origin so normalize stays pure
**Why:** Distance-from-parcel needs the origin point, which isn't in the USGS
response. `fetchRaw` returns `{ origin, response }` so `normalize` can compute
haversine distances deterministically (and be unit-tested on a saved fixture).
Quiet state is reassuring by design: zero quakes → a green "nothing recorded"
panel, not a blank.

---

## 2026-05-31 — Zoning "what can I do here?" engine

### The brief's KCC citation was stale — verified the current section (Rule #1 win)
**Why:** The brief assumed the dimensional-standards table lived at
**KCC 21A.12.030**. Live verification found that section was **repealed** in
King County's 2024 reorganization (Ord. 19881); rural-area standards now live at
**KCC 21A.09T.030**. Hardcoding the brief's citation would have pointed every
zoning answer at a dead section — exactly the failure Operating Rule #1 prevents.
All citations were verified against the current code + the March 2026 ADU permit
sheet before being encoded. Verified sections: dimensions `21A.09T.030`, ADU
`21A.08.030.B.7`, home occupation (RA) `21A.30.085`.

### Scope: detailed rules for RA zones only; everything else "check with county"
**Why:** Vashon / unincorporated KC is overwhelmingly Rural Area (RA) zoned. We
encode verified rules for RA-2.5/5/10/20 and return an honest "check with county"
for other zones rather than asserting unverified standards. Keeps the engine
correct-by-construction and avoids inventing rules we haven't verified.

### Lot-size-aware verdicts, but humble ones
**Why:** We use the parcel's acreage (live county data) to make ADU and
subdivision verdicts concrete (e.g. "your ~1.01-ac lot is below the ~1.875-ac
minimum"). But subdivision never returns "likely yes" — it caps at "conditional"
because clustering, critical areas, access, and water/septic always require
county review. Verdicts degrade to "check with county" when acreage is missing.

### Dropped the raw base-density (du/ac) figures from the UI
**Why:** The verified base densities are counterintuitive (RA-2.5 and RA-5 both
0.2 du/ac, with RA-2.5's higher density only reachable via TDR) and easy to
misread. We drive subdivision logic off the **minimum lot area** instead (values
that form a clean, self-consistent 0.75× pattern across zones — a good sign they
were read correctly) and never show a number we're unsure of.

### Zoning analysis is provenance "confirmed" (computed from code)
**Why:** Like the tax calendar, verdicts are computed from statute/code, not
fetched — confidence "confirmed", source "Computed from King County Code (Title
21A)". The disclaimer ("not a legal determination, confirm with County
Permitting") is rendered on every analysis.

---

## 2026-05-31 — Slice 2: tax & assessment

### Assessment values come from the same layer-1722 row (no new network call)
**Why:** Layer 1722 already returns `APPRLNDVAL`, `APPR_IMPR`, `TAX_LNDVAL`,
`TAX_IMPR`, `LEVYCODE`, `LEVY_JURIS`, `KCTP_TAXYR`, `ACCNT_NUM`. We extended the
parcel adapter to capture them into a nested `assessment` object rather than
adding a second source/fetch. Verified the values match the county's eReal
Property page exactly ($414k land + $658k improvements = $1.072M, TY 2026). The
**bulk assessor roll** (full sale history, authoritative valuations) remains a
later scheduled-ingest task — the GIS layer is a sufficient live snapshot for
the value panel now.

### `appraisedTotal` is computed only when both components are present
**Why:** The layer gives land + improvement separately, not a total. Summing two
real values is arithmetic, not invention — but if either component is missing we
return null rather than a misleading partial total.

### Tax deadlines are computed RULES (confidence "confirmed"), not a feed
**Why:** WA due dates (Apr 30 / Oct 31, RCW 84.56.020) and the BOE appeal window
(July 1 floor, RCW 84.40.038) are statute. `lib/tax/deadlines.ts` computes them
purely from a reference date (unit-tested across many dates). They carry
confidence `confirmed` with the RCW citation as the source label — demonstrating
a second provenance type alongside live-fetched data on the same page. Date math
is UTC date-only; a Pacific-time refinement near midnight is a noted TODO.

### Live tax balance = deep-link to eReal Property, no scraping (v1)
**Why:** There's no public API for the live bill. We deep-link to the verified
`blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=<PIN>` record
(which carries the balance + sale history). Privacy note: that county page shows
owner names, but **linking to the government's authoritative page is not
republishing** — our own UI still surfaces zero person-keyed data.

---

## 2026-05-31 — Slice 1: King County parcel core

### One denormalized layer (1722) is the whole Slice 1 source
**Why:** `property__parcel_address_area` layer 1722 joins parcel + address +
assessor attributes, so a single query yields PIN, address, coordinates, lot
size, zoning, and present use. Avoids fanning out across the geometry layer
(439), zoning layer (450), and an assessor table for the baseline report. The
authoritative planning zoning layer (450) is still reserved for the Phase 2
zoning engine; Slice 1 surfaces the Assessor's `KCA_ZONING` with that provenance.

### Address search is a plain function, not a DataSourceAdapter
**Why:** `DataSourceAdapter` models "fetch one parcel's facts." Address search
resolves a string to a *list* of candidate parcels (the confirm-the-parcel
step) — a different shape. It lives in the King County module as
`searchParcelsByAddress` and is wrapped by the `searchParcels` service with
graceful-degradation handling (distinguishes "no matches" from "source down").

### Panel-level provenance badges
**Why:** All Slice 1 fields share one source + fetch time, so a badge per field
would be noisy. Each report *panel* carries one badge. When later slices add
fields from other sources, those panels get their own badges. Honest and
consistent without clutter.

### Parcel data confidence is "live", not "confirmed"
**Why:** A user picking their parcel from search doesn't make the county data
authoritative — it's still fresh-from-source. `confirmed` stays reserved for
genuinely authoritative verification. Slice 1 badges read "Live" with the real
fetch date.

### In-memory cache for Slice 1; Redis/Postgres deferred until a slice needs them
**Why:** The baseline report is served live from the county API + process cache —
no DB or Redis required, so Slice 1 runs with zero infrastructure. Container
runtime + Redis swap-in happens when Slice 2 (assessor bulk roll) / Slice 5
(radius queries) actually need persistence. The `SourceCache` interface makes
the swap a one-line change (`/lib/adapters/cache-instance.ts`).

### Input safety on every county query
**Why:** User input reaches ArcGIS `where` clauses. PINs are validated against
`^\d{10}$`; address terms are uppercased, stripped to address-safe characters,
length-capped, and single quotes are doubled (`escapeArcgisLiteral`). Fetches
use `cache: "no-store"` + an 8s `AbortSignal.timeout` so the platform never
masquerades stale data as fresh and a hung source degrades gracefully.

---

## 2026-05-31 — Phase 0 foundation

### ORM: Drizzle (not Prisma)
**Why:** The core of this app is spatial — parcel geometry and "within X miles"
radius queries. Prisma still treats PostGIS `geometry` as an `Unsupported` type,
forcing raw SQL for exactly those queries. Drizzle lets us declare geometry
columns (`db/schema.ts`) and compose `ST_DWithin` / `ST_Intersects` naturally,
with a lighter runtime that fits the near-zero-marginal-cost goal.

### ArcGIS Maps SDK is client-side only
**Why:** The heavy Esri JS SDK is for rendering the map in the browser. All
server-side geospatial work (geocode, parcel point-query, radius) is plain
authenticated REST (`?f=json`) against King County's hosted feature services.
Keeping the SDK out of the backend protects bundle size, limits Esri credit
burn, and makes adapters testable without a browser. Enforced via the
`/lib/maps` abstraction so we can swap to MapLibre + free tiles later. See
[maps.md](./maps.md).

### Confidence is computed centrally, never asserted by adapters
**Why:** "Honest freshness" is product law. `computeFreshness()` in
`/lib/provenance` derives `live` vs `stale` purely from the cache timestamp and
the adapter's `refreshTtlSeconds`. An adapter cannot mislabel stale data as
live because it doesn't set confidence at all. `confirmed` is the one state set
explicitly (authoritatively verified data, e.g. a user-confirmed parcel).

### Auth: Auth.js (NextAuth v5) email magic-link, stubbed for now
**Why:** Self-hosted magic-link keeps marginal cost ~$0, fitting the $25/yr unit
economics and the privacy-by-design stance (no third-party identity vendor
holding user data). Phase 0 stubs auth behind the `AUTH_ENABLED` flag with a
dev session (`/lib/auth`); the real wiring lands in Phase 6. Kept behind a thin
interface so the provider stays swappable.

### Dev infra: Docker Compose (Postgres+PostGIS, Redis)
**Why:** Reproducible, no global installs, nothing paid/cloud. Not required for
Phase 0 (the app runs empty without a DB); needed from Slice 1. `docker-compose.yml`
is written; standing up a container runtime is deferred until Slice 1 needs it.

### In-memory source cache for Phase 0
**Why:** Lets the adapter pattern be demonstrated and unit-tested without
infrastructure. Swapped for a Redis-backed `SourceCache` in Slice 1 behind the
same interface (`/lib/adapters/cache.ts`) — no adapter changes.

### Tailwind 3.4 (not 4)
**Why:** Stable PostCSS config and ecosystem compatibility for now; revisit
Tailwind 4 once the design system settles.

---

## Environment note (2026-05-31)
Dev machine arrived with **no Node.js, no Homebrew, no Docker, and no
passwordless sudo** (Apple Silicon, macOS 14.4.1). Decision: install Node via
Homebrew (user-run, needs admin password). All scaffold files were authored
without Node; `npm install` / `npm run dev` pending toolchain install.
