/**
 * King County mapped "critical areas" (sensitive areas) at a parcel point — the
 * landslide / steep-slope / erosion / seismic / coal-mine / channel-migration
 * hazard designations that carry REGULATORY weight (development restrictions).
 *
 * One ArcGIS `identify` call against the gismaps Environment/KingCo_SensitiveAreas
 * service returns every layer the point falls in; we keep the hazard layers.
 * Verified live 2026-06-02 — the Vashon test parcel is in landslide + steep-slope
 * + erosion hazard areas. See /docs/data-sources.md.
 */

const IDENTIFY =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Environment/KingCo_SensitiveAreas/MapServer/identify";

/** Hazard layer id → homeowner-facing name (non-hazard layers are ignored). */
const HAZARD_LAYERS: Record<number, string> = {
  1: "Landslide hazard area",
  3: "Landslide hazard area",
  4: "Steep slope hazard",
  7: "Erosion hazard",
  8: "Seismic hazard area",
  9: "Coal mine hazard",
  15: "Channel migration hazard",
  17: "Debris flow hazard",
};

interface IdentifyResult {
  layerId: number;
  layerName?: string;
  value?: string;
}

/** Pure: map identify results → the distinct hazard names that apply. */
export function parseHazardHits(results: IdentifyResult[]): string[] {
  const names = new Set<string>();
  for (const r of results) {
    const name = HAZARD_LAYERS[r.layerId];
    if (name) names.add(name);
  }
  return [...names];
}

/** Which KC critical-area hazards apply at this point. [] = none mapped here. */
export async function getSensitiveAreas(lat: number, lon: number): Promise<string[]> {
  // identify needs a screen-space context; a tiny extent around the point with a
  // small tolerance approximates a point-in-polygon test.
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: "all:1,3,4,7,8,9,15,17",
    tolerance: "2",
    mapExtent: `${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}`,
    imageDisplay: "256,256,96",
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${IDENTIFY}?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KC SensitiveAreas HTTP ${res.status}`);
  const json = (await res.json()) as { results?: IdentifyResult[] };
  return parseHazardHits(json.results ?? []);
}
