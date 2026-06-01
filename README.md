# ParcelWatch

Property & neighborhood intelligence — **trust through provenance**. Type an
address, confirm the parcel, and get a plain-language dashboard of what you own,
what it's worth, what you can do with it, what constrains it, what you pay, and
what's changing nearby. Every datum shows its source and last-refreshed date.

First market: **Vashon Island / unincorporated King County, WA**. Jurisdiction
logic lives behind a data-source adapter interface so other counties can be
added later.

## Status

**Phase 0 — foundation.** Running empty app: stack, interfaces
(`DataSourceAdapter`, `SourcedValue`), the `<ProvenanceBadge/>` component, auth
stubbed behind a flag. No live data yet. Next: Slice 1 (King County parcel core).

## Stack

- **Next.js (App Router) + TypeScript** — SSR public pages + API routes
- **Tailwind CSS** — hand-rolled primitives, no heavy component library
- **PostgreSQL + PostGIS** with **Drizzle** ORM — spatial queries
- **Redis** (cache) + **BullMQ** (watch pollers) — Slice 1 / Phase 5
- **ArcGIS Maps SDK** — client-side map only; server uses keyless REST (see [docs/maps.md](docs/maps.md))
- **Auth.js magic-link** — stubbed in Phase 0, wired in Phase 6
- **Stripe** — not integrated until confirmed

## Prerequisites

- Node.js >= 18.18 (install via Homebrew: `brew install node`)
- (Slice 1+) A container runtime for Postgres/Redis — Docker Desktop or Colima

## Getting started

```bash
cp .env.example .env      # fill in as needed; never commit .env
npm install
npm run dev               # http://localhost:3000
```

For the DB/cache (not needed for Phase 0):

```bash
docker compose up -d db redis
npm run db:generate       # generate migrations from db/schema.ts
npm run db:migrate
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (adapter normalizers, provenance) |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle |

## Repo structure

```
/app          Next.js routes (public pages, dashboard, api/)
/lib
  /adapters   DataSourceAdapter interface, cache, run orchestration
  /provenance SourcedValue + confidence helpers
  /maps       Esri abstraction layer
  /zoning     "what can I do here" rules engine (Phase 2)
  /watches    pollers / diffing / alerts (Phase 5)
  /auth       auth abstraction (stubbed Phase 0)
/components    UI primitives incl. <ProvenanceBadge/>
/db            Drizzle schema + migrations (PostGIS)
/jobs          BullMQ worker entrypoints (Phase 5)
/docs          data-sources.md, DECISIONS.md, maps.md, privacy.md
/tests         normalizer + provenance tests with fixtures
```

## Product law (non-negotiables)

Provenance on everything · privacy by design (no person-keyed data — see
[docs/privacy.md](docs/privacy.md)) · honest freshness (real cache timestamps) ·
WCAG 2.1 AA · graceful degradation · never invent data.
