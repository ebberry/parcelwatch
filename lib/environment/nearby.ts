import { haversineKm, kmToMiles } from "@/lib/geo";

/** A shared shape for "nearby sites" sources (EPA, …). Distances in miles. */
export interface NearbySite {
  name: string | null;
  detail: string | null;
  distanceMi: number | null;
}

export interface NearbySites {
  count: number;
  radiusMi: number;
  nearest: NearbySite[];
}

/** Intermediate item produced by each adapter before distance/sort. */
export interface RawSite {
  name: string | null;
  detail: string | null;
  lat: number | null;
  lon: number | null;
}

/**
 * Compute distances from the origin (in miles), sort nearest-first, and keep the
 * closest `take`. `count` is the total within the queried radius (after the
 * caller's own de-duplication). Pure + testable.
 */
export function buildNearbySites(
  origin: { lat: number; lon: number },
  sites: RawSite[],
  opts: { radiusMi: number; take?: number },
): NearbySites {
  const withDist: NearbySite[] = sites.map((s) => ({
    name: s.name,
    detail: s.detail,
    distanceMi:
      s.lat != null && s.lon != null
        ? Math.round(kmToMiles(haversineKm(origin.lat, origin.lon, s.lat, s.lon)) * 10) / 10
        : null,
  }));
  withDist.sort((a, b) => (a.distanceMi ?? 1e9) - (b.distanceMi ?? 1e9));
  return {
    count: sites.length,
    radiusMi: opts.radiusMi,
    nearest: withDist.slice(0, opts.take ?? 5),
  };
}
