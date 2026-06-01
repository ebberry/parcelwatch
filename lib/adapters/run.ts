import type { DataSourceAdapter, ParcelLookupContext } from "./types";
import type { SourceCache } from "./cache";
import { sourced, unavailable } from "@/lib/provenance";
import type { SourcedValue } from "@/lib/provenance";

/**
 * Orchestrates one adapter into a SourcedValue:
 *   cache hit + fresh   -> serve cached, confidence "live"
 *   cache hit + stale    -> revalidate; on success "live", on failure serve
 *                           the stale copy as "stale" (graceful degradation)
 *   cache miss           -> fetch live; on failure "unavailable"
 *
 * Confidence is computed centrally from the timestamp + TTL, so no adapter can
 * mislabel stale data as live. The normalized blob carries one provenance here;
 * per-field provenance composition is layered on in Slice 1's dashboard.
 */
export async function runAdapter<TRaw, TNorm>(
  adapter: DataSourceAdapter<TRaw, TNorm>,
  input: ParcelLookupContext,
  opts: { cache: SourceCache; cacheKey?: string; nowMs?: number },
): Promise<SourcedValue<TNorm>> {
  const now = opts.nowMs ?? Date.now();
  const key = opts.cacheKey ?? `${adapter.id}:${stableKey(input)}`;
  const ttl = adapter.refreshTtlSeconds;

  const cached = await opts.cache.get<TNorm>(key);
  if (cached) {
    const ageMs = now - Date.parse(cached.fetchedAt);
    if (ageMs <= ttl * 1000) {
      // Fresh — no need to hit the network.
      return sourced(cached.value, {
        source: adapter.sourceLabel,
        fetchedAt: cached.fetchedAt,
        ttlSeconds: ttl,
        nowMs: now,
      });
    }
  }

  // Need a live fetch (miss or stale).
  try {
    const raw = await adapter.fetchRaw(input);
    const normalized = adapter.normalize(raw);
    const fetchedAt = new Date(now).toISOString();
    await opts.cache.set(key, normalized, fetchedAt);
    return sourced(normalized, {
      source: adapter.sourceLabel,
      fetchedAt,
      ttlSeconds: ttl,
      nowMs: now,
    });
  } catch {
    // Live fetch failed. If we have any cached copy, serve it as stale rather
    // than blanking the panel. Otherwise: explicitly unavailable.
    if (cached) {
      return sourced(cached.value, {
        source: adapter.sourceLabel,
        fetchedAt: cached.fetchedAt,
        ttlSeconds: ttl,
        nowMs: now,
      });
    }
    return unavailable(adapter.sourceLabel);
  }
}

/** Deterministic cache key from the lookup context. */
function stableKey(input: ParcelLookupContext): string {
  if (input.parcelId) return `pin:${input.parcelId}`;
  if (input.lat != null && input.lon != null) {
    return `pt:${input.lat.toFixed(6)},${input.lon.toFixed(6)}`;
  }
  return `addr:${(input.address ?? "").trim().toLowerCase()}`;
}
