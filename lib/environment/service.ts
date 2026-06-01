import { runAdapter } from "@/lib/adapters";
import { sourceCache } from "@/lib/adapters/cache-instance";
import { epaFrsAdapter } from "@/lib/adapters/epa/sites";
import {
  fetchServingWaterSystem,
  type WaterLookup,
} from "@/lib/adapters/doh/water";
import { fetchNeighborhoodStats, type NeighborhoodStats } from "@/lib/adapters/census/neighborhood";
import { unavailable, type SourcedValue } from "@/lib/provenance";
import type { NearbySites } from "@/lib/environment/nearby";

export type { NearbySites, NearbySite } from "@/lib/environment/nearby";
export type { NeighborhoodStats } from "@/lib/adapters/census/neighborhood";
export type { WaterLookup, WaterSystem } from "@/lib/adapters/doh/water";

type LatLon = { lat: number | null; lon: number | null };
const noCoords = ({ lat, lon }: LatLon) => lat == null || lon == null;

export async function getEpaSites(lat: number | null, lon: number | null): Promise<SourcedValue<NearbySites>> {
  if (noCoords({ lat, lon })) return unavailable(epaFrsAdapter.sourceLabel);
  return runAdapter(epaFrsAdapter, { lat: lat!, lon: lon! }, { cache: sourceCache });
}

const WATER_LABEL = "WA Dept of Health (drinking water)";

/** The water system whose service area contains the parcel, if any. */
export async function getWaterSystem(
  lat: number | null,
  lon: number | null,
): Promise<SourcedValue<WaterLookup>> {
  if (noCoords({ lat, lon })) return unavailable(WATER_LABEL);
  try {
    const value = await fetchServingWaterSystem(lat!, lon!);
    return { value, source: WATER_LABEL, fetchedAt: new Date().toISOString(), confidence: "live" };
  } catch {
    return unavailable(WATER_LABEL);
  }
}

/** True when a Census API key is configured (gates the neighborhood-stats panel). */
export function censusKeyConfigured(): boolean {
  return Boolean(process.env.CENSUS_API_KEY);
}

export async function getNeighborhoodStats(
  lat: number | null,
  lon: number | null,
): Promise<SourcedValue<NeighborhoodStats>> {
  const source = "U.S. Census ACS (5-year)";
  const key = process.env.CENSUS_API_KEY;
  if (!key || lat == null || lon == null) return unavailable(source);
  try {
    const value = await fetchNeighborhoodStats(lat, lon, key);
    if (!value) return unavailable(source);
    return { value, source, fetchedAt: new Date().toISOString(), confidence: "live" };
  } catch {
    return unavailable(source);
  }
}
