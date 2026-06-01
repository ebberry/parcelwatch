/**
 * Source-response cache abstraction.
 *
 * Phase 0 ships an in-memory implementation so the adapter pattern is
 * demonstrable and testable without infrastructure. Slice 1 swaps in a Redis
 * implementation (REDIS_URL) behind this same interface — no adapter changes.
 */

export interface CacheEntry<T> {
  value: T;
  /** ISO timestamp the value was fetched from the live source. */
  fetchedAt: string;
}

export interface SourceCache {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, value: T, fetchedAt: string): Promise<void>;
}

/** In-memory cache. Phase 0 only — process-local, not shared, not persistent. */
export class MemorySourceCache implements SourceCache {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    return (this.store.get(key) as CacheEntry<T> | undefined) ?? null;
  }

  async set<T>(key: string, value: T, fetchedAt: string): Promise<void> {
    this.store.set(key, { value, fetchedAt });
  }
}
