export const KM_PER_MILE = 1.609344;

/** Convert kilometers to miles. */
export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

/** Convert miles to kilometers. */
export function milesToKm(mi: number): number {
  return mi * KM_PER_MILE;
}

/** Rough centroid of a polygon's first ring (geometry in WGS84). */
export function polygonRingCentroid(
  geometry: unknown,
): { lat: number; lon: number } | null {
  const ring = (geometry as { rings?: number[][][] } | null)?.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return { lon: sx / ring.length, lat: sy / ring.length };
}

/** Great-circle distance between two WGS84 points, in kilometers. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371; // mean Earth radius, km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
