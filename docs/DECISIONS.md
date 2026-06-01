# Architecture Decision Log

Running log of every non-obvious choice and why. Newest first.

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
