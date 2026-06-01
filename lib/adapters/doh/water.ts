import type { DataSourceAdapter, ParcelLookupContext } from "@/lib/adapters/types";
import { queryArcgisNearby } from "@/lib/adapters/arcgis";
import { buildNearbySites, type NearbySites, type RawSite } from "@/lib/environment/nearby";

/**
 * WA Dept of Health — public drinking-water systems near a point (Office of
 * Drinking Water / Sentry). Keyless ArcGIS Online FeatureServer, verified
 * 2026-05-31. This layer has no lat/lon fields, so we read geometry (outSR 4326).
 */

const DW_QUERY =
  "https://services8.arcgis.com/rGGrs6HCnw87OFOT/arcgis/rest/services/Drinking_Water_Systems/FeatureServer/0/query";

const RADIUS_M = 3000;

interface DwAttrs {
  WS_Name: string | null;
  WS_Grp: string | null; // A | B
  WS_Status: string | null;
}

export interface RawDoh {
  origin: { lat: number; lon: number };
  rows: { attrs: DwAttrs; lat: number | null; lon: number | null }[];
}

export const dohWaterAdapter: DataSourceAdapter<RawDoh, NearbySites> = {
  id: "doh.water",
  sourceLabel: "WA Dept of Health (drinking water)",
  refreshTtlSeconds: 7 * 24 * 60 * 60,

  async fetchRaw(input: ParcelLookupContext): Promise<RawDoh> {
    if (input.lat == null || input.lon == null) throw new Error("coords required");
    const features = await queryArcgisNearby<DwAttrs>({
      queryUrl: DW_QUERY,
      lat: input.lat,
      lon: input.lon,
      distanceMeters: RADIUS_M,
      outFields: "WS_Name,WS_Grp,WS_Status",
      returnGeometry: true, // no lat/lon fields on this layer
      limit: 50,
    });
    return {
      origin: { lat: input.lat, lon: input.lon },
      rows: features.map((f) => ({
        attrs: f.attributes,
        lat: f.geometry?.y ?? null,
        lon: f.geometry?.x ?? null,
      })),
    };
  },

  normalize(raw: RawDoh): NearbySites {
    const sites: RawSite[] = raw.rows.map(({ attrs, lat, lon }) => {
      const grp = attrs.WS_Grp ? `Group ${attrs.WS_Grp}` : null;
      const status = attrs.WS_Status?.trim() || null;
      const detail = [grp, status].filter(Boolean).join(" · ") || null;
      return { name: attrs.WS_Name?.trim() || null, detail, lat, lon };
    });
    return buildNearbySites(raw.origin, sites, { radiusKm: RADIUS_M / 1000, take: 6 });
  },
};
