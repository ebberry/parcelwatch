# Maps & geospatial abstraction

## Principle: surgical Esri, not Esri-everywhere

The user has an ArcGIS subscription, so we use it — but deliberately, in two
narrow places:

1. **Client-side map rendering** — the ArcGIS Maps SDK for JavaScript draws the
   basemap and the draggable radius UI in the browser. This is the only place
   the heavy SDK is loaded.
2. **Esri geocoder** — address → coordinates, as the primary geocode (with the
   US Census Geocoder as a keyless fallback, per Slice 4).

Everything else — parcel point-queries, "within X miles" radius queries, present
-use/zoning lookups — is **plain authenticated REST** against King County's
hosted feature services (`?f=json`), run server-side. No browser, no SDK.

## Why

- **Bundle size:** the Esri JS SDK is large; keeping it off the server and out
  of non-map routes keeps the app fast and mobile-friendly.
- **Esri credit burn:** routing every spatial query through Esri services costs
  credits. PostGIS does radius/containment locally once we have geometry.
- **Testability:** adapters that use `fetch` can be unit-tested with saved
  fixtures; adapters that need a browser SDK cannot.
- **Portability:** the `MapProvider` interface in [`/lib/maps`](../lib/maps/index.ts)
  means we can swap to **MapLibre GL + a free tile source** (and a keyless
  geocoder) later if Esri credit costs become a problem at scale, without
  touching callers.

## The abstraction

`/lib/maps/index.ts` defines `MapProvider`:
- `geocode(address)` → candidates
- `parcelAtPoint(point)` → parcel id

Server code depends only on this interface. Concrete implementations (Esri REST;
later, a free stack) are injected. Phase 0 ships the interface; the King County
implementation lands in Slice 1.

## Open items
- Confirm the current King County parcel feature-service URL, layer index, field
  names, and `maxRecordCount` (see [data-sources.md](./data-sources.md)).
- Decide PostGIS-vs-Esri split for radius queries once parcel geometry is in the
  DB (likely PostGIS for the common case, Esri only for live county layers).
