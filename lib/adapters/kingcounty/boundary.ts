/**
 * King County parcel boundary geometry (the polygon ring), for the parcel map.
 * Same gismaps layer as the parcel adapter, but here we keep the full ring in
 * WGS84 rather than collapsing to a centroid. Degrades to null on any failure.
 */

const PARCEL_GEOM_QUERY =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query";

export interface ParcelBoundary {
  /** Outer ring as [lon, lat] pairs (WGS84). */
  ring: [number, number][];
}

export async function getParcelBoundary(
  pin: string | null,
): Promise<ParcelBoundary | null> {
  if (!pin) return null;
  const safe = pin.replace(/'/g, "");
  const url =
    `${PARCEL_GEOM_QUERY}?where=PIN='${safe}'` +
    `&returnGeometry=true&outSR=4326&outFields=PIN&f=json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 }, // parcel shape is ~static
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { rings?: number[][][] } }[];
      error?: unknown;
    };
    if (data.error) return null;
    const ring = data.features?.[0]?.geometry?.rings?.[0];
    if (!ring || ring.length < 3) return null;
    return { ring: ring.map(([lon, lat]) => [lon, lat] as [number, number]) };
  } catch {
    return null;
  }
}
