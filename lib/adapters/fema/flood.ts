import type { DataSourceAdapter, ParcelLookupContext } from "@/lib/adapters/types";

/**
 * FEMA National Flood Hazard Layer (NFHL) — flood zone at a point.
 *
 * Keyless ArcGIS REST. Endpoint verified 2026-05-31: the live host is
 * `hazards.fema.gov/arcgis/rest/...` (the old `/gis/nfhl/` path is dead).
 * Layer 28 = "Flood Hazard Zones". See /docs/data-sources.md.
 */

const NFHL_FLOOD_ZONES_QUERY =
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

/** STATIC_BFE sentinel meaning "no base flood elevation". */
const NO_BFE = -9000;

export interface RawFloodAttributes {
  FLD_ZONE: string | null;
  ZONE_SUBTY: string | null;
  SFHA_TF: string | null; // "T" | "F"
  STATIC_BFE: number | null;
  DFIRM_ID: string | null;
}

export interface FloodHazard {
  /** False when the point isn't covered by FEMA's mapped flood data. */
  mapped: boolean;
  floodZone: string | null;
  zoneSubtype: string | null;
  /** In a Special Flood Hazard Area (high risk). */
  inSFHA: boolean | null;
  baseFloodElevationFt: number | null;
  firmId: string | null;
}

function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

export const femaFloodAdapter: DataSourceAdapter<
  RawFloodAttributes | null,
  FloodHazard
> = {
  id: "fema.flood",
  sourceLabel: "FEMA National Flood Hazard Layer",
  // NFHL updates roughly monthly.
  refreshTtlSeconds: 30 * 24 * 60 * 60,

  async fetchRaw(input: ParcelLookupContext): Promise<RawFloodAttributes | null> {
    if (input.lat == null || input.lon == null) {
      throw new Error("FEMA flood lookup requires coordinates");
    }
    const params = new URLSearchParams({
      geometry: `${input.lon},${input.lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DFIRM_ID",
      returnGeometry: "false",
      f: "json",
    });
    const res = await fetch(`${NFHL_FLOOD_ZONES_QUERY}?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`FEMA NFHL returned HTTP ${res.status}`);
    const json = (await res.json()) as {
      features?: { attributes: RawFloodAttributes }[];
      error?: { message: string };
    };
    if (json.error) throw new Error(`FEMA NFHL: ${json.error.message}`);
    // No polygon at the point = point not in mapped flood data (a valid result).
    return json.features?.[0]?.attributes ?? null;
  },

  normalize(raw: RawFloodAttributes | null): FloodHazard {
    if (!raw) {
      return {
        mapped: false,
        floodZone: null,
        zoneSubtype: null,
        inSFHA: null,
        baseFloodElevationFt: null,
        firmId: null,
      };
    }
    const sfha =
      raw.SFHA_TF === "T" ? true : raw.SFHA_TF === "F" ? false : null;
    const bfe =
      raw.STATIC_BFE != null && raw.STATIC_BFE > NO_BFE ? raw.STATIC_BFE : null;
    return {
      mapped: true,
      floodZone: clean(raw.FLD_ZONE),
      zoneSubtype: clean(raw.ZONE_SUBTY),
      inSFHA: sfha,
      baseFloodElevationFt: bfe,
      firmId: clean(raw.DFIRM_ID),
    };
  },
};
