/**
 * The data-source adapter pattern is the single most important structural
 * decision in ParcelWatch (see project brief §5 and /docs/DECISIONS.md).
 * Everything jurisdiction-specific lives behind this interface so we can add
 * other counties later without rewriting the app.
 *
 * No screen reads a raw API response directly. Adapters fetch + normalize;
 * the cache wrapper (see ./run.ts) attaches provenance.
 */

/** Shared input passed to adapters. Expanded per slice as more is known. */
export interface ParcelLookupContext {
  /** County parcel identifier (PIN) once resolved. */
  parcelId?: string;
  /** WGS84 coordinates of the parcel/point, once geocoded. */
  lat?: number;
  lon?: number;
  /** Raw user-entered address, before parcel confirmation. */
  address?: string;
}

export interface DataSourceAdapter<TRaw, TNormalized> {
  /** Stable id, e.g. "kingcounty.parcel". Used as the cache key prefix. */
  id: string;
  /** Human label shown in the provenance badge, e.g. "King County Assessor". */
  sourceLabel: string;
  /** How long a cached response stays "live" before it is flagged "stale". */
  refreshTtlSeconds: number;
  /** Hit the live source. Should throw on transport/HTTP failure. */
  fetchRaw(input: ParcelLookupContext): Promise<TRaw>;
  /** Turn messy government JSON into our clean internal shape. Pure + tested. */
  normalize(raw: TRaw): TNormalized;
}
