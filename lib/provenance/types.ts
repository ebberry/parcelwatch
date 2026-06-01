/**
 * Provenance is product law (see /docs/privacy.md and the project brief).
 * Every datum rendered to a user is a SourcedValue: it carries its source,
 * the timestamp it was fetched, and a confidence state. No naked numbers.
 */

export type Confidence =
  | "confirmed" // authoritatively verified (e.g. a parcel the user confirmed)
  | "live" // served from cache, still within the source's freshness TTL
  | "stale" // served from cache, past TTL — shown but flagged as unverified
  | "unavailable"; // source down or field missing — we say so, never invent

export interface SourcedValue<T> {
  /** The datum. `null` when the source is unavailable or the field is missing. */
  value: T | null;
  /** Human-readable source label shown in the provenance badge. */
  source: string;
  /** ISO timestamp the value was fetched from the live source. `null` if never. */
  fetchedAt: string | null;
  confidence: Confidence;
}
