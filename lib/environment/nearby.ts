import { haversineKm } from "@/lib/geo";

/** A shared shape for "nearby sites" sources (EPA, Ecology, DOH). */
export interface NearbySite {
  name: string | null;
  detail: string | null;
  distanceKm: number | null;
}

export interface NearbySites {
  count: number;
  radiusKm: number;
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
 * Compute distances from the origin, sort nearest-first, and keep the closest
 * `take`. `count` is the total within the queried radius (after the caller's
 * own de-duplication). Pure + testable.
 */
export function buildNearbySites(
  origin: { lat: number; lon: number },
  sites: RawSite[],
  opts: { radiusKm: number; take?: number },
): NearbySites {
  const withDist: NearbySite[] = sites.map((s) => ({
    name: s.name,
    detail: s.detail,
    distanceKm:
      s.lat != null && s.lon != null
        ? Math.round(haversineKm(origin.lat, origin.lon, s.lat, s.lon) * 10) / 10
        : null,
  }));
  withDist.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  return {
    count: sites.length,
    radiusKm: opts.radiusKm,
    nearest: withDist.slice(0, opts.take ?? 5),
  };
}
