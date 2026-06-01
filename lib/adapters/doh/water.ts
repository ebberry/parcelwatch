/**
 * WA Dept of Health — drinking water for an address.
 *
 * "Who supplies my water?" is answered by the SERVICE-AREA polygon that contains
 * the parcel (not a list of nearby systems). When the point falls in no mapped
 * service area (common for rural wells / small Group B systems), we report "not
 * found" and let the owner search + add their own. Keyless ArcGIS Online,
 * verified 2026-05-31. See /docs/data-sources.md.
 */

const SERVICE_AREAS =
  "https://services8.arcgis.com/rGGrs6HCnw87OFOT/arcgis/rest/services/Drinking_Water_Service_Areas/FeatureServer/0/query";
const WATER_SYSTEMS =
  "https://services8.arcgis.com/rGGrs6HCnw87OFOT/arcgis/rest/services/Drinking_Water_Systems/FeatureServer/0/query";

export interface WaterSystem {
  name: string;
  group: string | null; // A | B
  type: string | null;
  status: string | null;
  ownership: string | null;
  connections: number | null;
}

/** Result of the address lookup: found (in a service area) or not. */
export interface WaterLookup {
  found: boolean;
  system: WaterSystem | null;
}

export interface WaterSystemMatch {
  pwsId: string;
  name: string;
  group: string | null;
  status: string | null;
  city: string | null;
}

interface SaAttrs {
  WS_Name: string | null;
  WS_Grp: string | null;
  WS_Type: string | null;
  WS_Status: string | null;
  Ownership: string | null;
  Total_Conn: number | null;
}

const clean = (v: string | null | undefined) =>
  v == null ? null : v.replace(/\s+/g, " ").trim() || null;

async function arcgisGet<A>(
  url: string,
  params: Record<string, string>,
): Promise<{ attributes: A }[]> {
  const qs = new URLSearchParams({ f: "json", returnGeometry: "false", ...params });
  const res = await fetch(`${url}?${qs}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`WA DOH returned HTTP ${res.status}`);
  const json = (await res.json()) as {
    features?: { attributes: A }[];
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message);
  return json.features ?? [];
}

function toSystem(a: SaAttrs): WaterSystem {
  return {
    name: clean(a.WS_Name) ?? "Unnamed system",
    group: clean(a.WS_Grp),
    type: clean(a.WS_Type),
    status: clean(a.WS_Status),
    ownership: clean(a.Ownership),
    connections: a.Total_Conn ?? null,
  };
}

/** The water system whose service area contains the parcel, if any. */
export async function fetchServingWaterSystem(
  lat: number,
  lon: number,
): Promise<WaterLookup> {
  const features = await arcgisGet<SaAttrs>(SERVICE_AREAS, {
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    where: "1=1",
    outFields: "WS_Name,WS_Grp,WS_Type,WS_Status,Ownership,Total_Conn",
  });
  const first = features[0]?.attributes;
  return first ? { found: true, system: toSystem(first) } : { found: false, system: null };
}

/** Search water systems by name (for the manual "add your own" picker). */
export async function searchWaterSystems(query: string): Promise<WaterSystemMatch[]> {
  const term = query.toUpperCase().replace(/[^A-Z0-9 &/.\-']/g, " ").trim().slice(0, 60);
  if (term.length < 3) return [];
  const escaped = term.replace(/'/g, "''");
  const features = await arcgisGet<{
    PwsId: string | null;
    WS_Name: string | null;
    WS_Grp: string | null;
    WS_Status: string | null;
    WS_City: string | null;
  }>(WATER_SYSTEMS, {
    where: `UPPER(WS_Name) LIKE '%${escaped}%'`,
    outFields: "PwsId,WS_Name,WS_Grp,WS_Status,WS_City",
    orderByFields: "WS_Name",
    resultRecordCount: "20",
  });
  return features.map((f) => ({
    pwsId: f.attributes.PwsId ?? "",
    name: clean(f.attributes.WS_Name) ?? "Unnamed system",
    group: clean(f.attributes.WS_Grp),
    status: clean(f.attributes.WS_Status),
    city: clean(f.attributes.WS_City),
  }));
}
