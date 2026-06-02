/**
 * WA DNR liquefaction susceptibility at a point — how prone the ground is to
 * liquefying in an earthquake (pairs with the NRI earthquake rating). From the
 * DNR Public_Geology "Ground_Response" service. The service publishes in WA
 * State Plane (WKID 2927); we pass the point as `inSR=4326` and let the server
 * reproject. Verified live 2026-06-02 (Vashon → "low to moderate").
 */

const LIQUEFACTION_QUERY =
  "https://gis.dnr.wa.gov/site1/rest/services/Public_Geology/Ground_Response/MapServer/0/query";

/** Susceptibility class at the point, e.g. "low to moderate", or null. */
export async function getLiquefaction(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "LIQUEFACTION_SUSCEPT",
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${LIQUEFACTION_QUERY}?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`WA DNR liquefaction HTTP ${res.status}`);
  const json = (await res.json()) as {
    features?: Array<{ attributes: { LIQUEFACTION_SUSCEPT?: string } }>;
  };
  const v = json.features?.[0]?.attributes?.LIQUEFACTION_SUSCEPT;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
