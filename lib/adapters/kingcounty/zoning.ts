/**
 * Authoritative zoning for a parcel — point-in-polygon against King County's
 * **planning** zoning layer, NOT the Assessor's `KCA_ZONING` attribute.
 *
 * Why this matters (verified 2026-06-03): the Assessor field is unreliable as
 * legal zoning. For parcels inside a city it stores the *city's* code (e.g. a
 * Seattle parcel reads "NR3"); feeding that into our King County Code (Title
 * 21A) engine produces standards that don't apply. The planning service is the
 * source of record: layer 1 `CURRZONE` is the King County zone (null inside
 * cities), and layer 0 `CITYNAME` tells us which city governs instead.
 */

const ZONE_QUERY =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Planning/KingCo_Zoning/MapServer/1/query";
const INCORP_QUERY =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Planning/KingCo_Zoning/MapServer/0/query";

export interface ZoningLookup {
  /** King County current zone (CURRZONE), e.g. "RA-2.5". Null inside a city. */
  currentZone: string | null;
  /** Planned/potential future zone (POTENTIAL), when present. */
  potentialZone: string | null;
  /** Incorporating city (CITYNAME) when the parcel is inside one — then King
   *  County does NOT set its zoning. Null for unincorporated King County. */
  city: string | null;
}

async function queryPoint(
  base: string,
  lat: number,
  lon: number,
  outFields: string,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${base}?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) throw new Error(`zoning ${res.status}`);
  const data = (await res.json()) as {
    features?: { attributes: Record<string, unknown> }[];
    error?: unknown;
  };
  if (data.error) throw new Error("zoning query error");
  return data.features?.[0]?.attributes ?? null;
}

export async function getZoning(
  lat: number | null,
  lon: number | null,
): Promise<ZoningLookup | null> {
  if (lat == null || lon == null) return null;
  // Both queries independently; an incorporated hit is decisive on its own.
  const [zone, incorp] = await Promise.all([
    queryPoint(ZONE_QUERY, lat, lon, "CURRZONE,POTENTIAL").catch(() => null),
    queryPoint(INCORP_QUERY, lat, lon, "CITYNAME,JURIS").catch(() => null),
  ]);
  // Both sources unreachable → no answer (caller degrades to unavailable).
  if (zone === null && incorp === null) return null;

  const cityRaw = (incorp?.CITYNAME as string | undefined)?.trim();
  const curr = (zone?.CURRZONE as string | undefined)?.trim();
  const pot = (zone?.POTENTIAL as string | undefined)?.trim();
  return {
    currentZone: curr || null,
    potentialZone: pot || null,
    city: cityRaw || null,
  };
}
