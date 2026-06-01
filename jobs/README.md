# /jobs — scheduled worker entrypoints

BullMQ workers that run the **watches** (project brief §6, Slice 5): scheduled
pollers that fetch a source, diff against last-seen state, and emit alerts with
provenance.

**Status:** Phase 0 placeholder. The watch interfaces live in
[`/lib/watches`](../lib/watches/index.ts). Worker entrypoints and the BullMQ
queue wiring are built in Phase 5, backed by Redis (`REDIS_URL`).

Planned workers:
- `permits-nearby` — radius query for new permits around the parcel
- `title-recorder` — owner-consented, owner's-parcel-only document recordings
- `council-agenda` — King County Council agenda keyword monitor
- `legislature-bills` — WA Legislature bill feed (property tax, septic, shoreline, ADUs, ferries)
