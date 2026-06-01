import { MemorySourceCache, type SourceCache } from "./cache";

/**
 * Process-shared source cache.
 *
 * Slice 1 uses the in-memory cache: single-process dev, zero infrastructure.
 * Slice 2+/production swaps in a Redis-backed SourceCache behind this same
 * accessor — no adapter or caller changes (see /docs/DECISIONS.md).
 *
 * Stored on globalThis so Next.js dev hot-reloads don't drop the cache.
 */
const globalForCache = globalThis as unknown as {
  __parcelwatchCache?: SourceCache;
};

export const sourceCache: SourceCache =
  globalForCache.__parcelwatchCache ?? new MemorySourceCache();

if (process.env.NODE_ENV !== "production") {
  globalForCache.__parcelwatchCache = sourceCache;
}
