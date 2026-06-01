# /jobs — scheduled worker entrypoints

BullMQ workers that run the **watches** (project brief §6, Slice 5): scheduled
pollers that fetch a source, diff against last-seen state, and emit alerts.

## Running

```bash
npm run worker   # tsx --env-file=.env jobs/worker.ts
```

Requires Redis + Postgres (Homebrew services) and `.env` with `REDIS_URL` +
`DATABASE_URL`. The worker registers a repeatable 6-hour poll and processes
"poll" jobs by running every watch ([`lib/watches/engine.ts`](../lib/watches/engine.ts)).
Manual trigger for testing: `POST /api/watches/poll`.

## Sources

- ✅ **council** — King County Council legislation via the Legistar Web API. Built.
- ⏳ **legislature** — WA Legislature web services. Wired into the engine; source
  adapter pending (its session is out until ~January, so it's quiet now).
- ⛔ **permits / recorder** — King County exposes no API (Accela / Landmark are
  interactive portals; terms forbid scraping). Deferred — see
  [/docs/data-sources.md](../docs/data-sources.md).
