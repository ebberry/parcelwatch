import type { Confidence, SourcedValue } from "./types";

export type { Confidence, SourcedValue } from "./types";

/**
 * Derive freshness purely from the cache timestamp and the source's TTL.
 * This is how "honest freshness" is made structural: an adapter cannot claim
 * "live" on stale data, because confidence is computed here, not asserted.
 *
 * `confirmed` is NOT derivable from a TTL — it is set explicitly for data we
 * have authoritatively verified (e.g. a user-confirmed parcel). It never
 * downgrades to "stale" on its own.
 *
 * @param nowMs injectable clock for testability (defaults to Date.now()).
 */
export function computeFreshness(
  fetchedAt: string | null,
  ttlSeconds: number,
  nowMs: number = Date.now(),
): Exclude<Confidence, "confirmed"> {
  if (!fetchedAt) return "unavailable";
  const fetchedMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedMs)) return "unavailable";
  const ageMs = nowMs - fetchedMs;
  return ageMs <= ttlSeconds * 1000 ? "live" : "stale";
}

/** Wrap a successfully-fetched value with computed freshness. */
export function sourced<T>(
  value: T | null,
  opts: {
    source: string;
    fetchedAt: string | null;
    ttlSeconds: number;
    /** Pass true to mark as authoritatively verified instead of live/stale. */
    confirmed?: boolean;
    nowMs?: number;
  },
): SourcedValue<T> {
  const confidence: Confidence =
    value === null
      ? "unavailable"
      : opts.confirmed
        ? "confirmed"
        : computeFreshness(opts.fetchedAt, opts.ttlSeconds, opts.nowMs);
  return {
    value,
    source: opts.source,
    fetchedAt: opts.fetchedAt,
    confidence,
  };
}

/** A source that is down or a field that is missing. Honest, never invented. */
export function unavailable<T>(source: string): SourcedValue<T> {
  return { value: null, source, fetchedAt: null, confidence: "unavailable" };
}
