import type { DataSourceAdapter, ParcelLookupContext } from "@/lib/adapters/types";
import { queryArcgisNearby } from "@/lib/adapters/arcgis";
import { buildNearbySites, type NearbySites, type RawSite } from "@/lib/environment/nearby";

/**
 * EPA Facility Registry Service (FRS) — regulated facilities near a point.
 * Keyless ArcGIS REST, layer 8 (all-programs FACILITY_INTERESTS). Verified
 * 2026-05-31. One physical site can appear once per program interest, so we
 * de-duplicate by REGISTRY_ID and aggregate the program acronyms.
 */

const FRS_QUERY =
  "https://geodata.epa.gov/arcgis/rest/services/OEI/FRS_INTERESTS/MapServer/8/query";

const RADIUS_M = 3000;

interface FrsAttrs {
  REGISTRY_ID: string | null;
  PRIMARY_NAME: string | null;
  PGM_SYS_ACRNM: string | null;
  LATITUDE83: number | null;
  LONGITUDE83: number | null;
}

export interface RawEpa {
  origin: { lat: number; lon: number };
  rows: FrsAttrs[];
}

export const epaFrsAdapter: DataSourceAdapter<RawEpa, NearbySites> = {
  id: "epa.frs",
  sourceLabel: "EPA Facility Registry Service",
  refreshTtlSeconds: 7 * 24 * 60 * 60,

  async fetchRaw(input: ParcelLookupContext): Promise<RawEpa> {
    if (input.lat == null || input.lon == null) throw new Error("coords required");
    const features = await queryArcgisNearby<FrsAttrs>({
      queryUrl: FRS_QUERY,
      lat: input.lat,
      lon: input.lon,
      distanceMeters: RADIUS_M,
      outFields: "REGISTRY_ID,PRIMARY_NAME,PGM_SYS_ACRNM,LATITUDE83,LONGITUDE83",
      limit: 50,
    });
    return { origin: { lat: input.lat, lon: input.lon }, rows: features.map((f) => f.attributes) };
  },

  normalize(raw: RawEpa): NearbySites {
    // De-dupe by REGISTRY_ID; collect distinct program acronyms per site.
    const byId = new Map<string, { row: FrsAttrs; programs: Set<string> }>();
    for (const r of raw.rows) {
      const id = r.REGISTRY_ID ?? `${r.PRIMARY_NAME}:${r.LATITUDE83}`;
      const entry = byId.get(id) ?? { row: r, programs: new Set<string>() };
      if (r.PGM_SYS_ACRNM) entry.programs.add(r.PGM_SYS_ACRNM);
      byId.set(id, entry);
    }
    const sites: RawSite[] = [...byId.values()].map(({ row, programs }) => ({
      name: row.PRIMARY_NAME?.trim() || null,
      detail: programs.size ? [...programs].join(", ") : null,
      lat: row.LATITUDE83 ?? null,
      lon: row.LONGITUDE83 ?? null,
    }));
    return buildNearbySites(raw.origin, sites, { radiusKm: RADIUS_M / 1000, take: 6 });
  },
};
