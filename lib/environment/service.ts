import { runAdapter } from "@/lib/adapters";
import { sourceCache } from "@/lib/adapters/cache-instance";
import { epaFrsAdapter } from "@/lib/adapters/epa/sites";
import { dohWaterAdapter } from "@/lib/adapters/doh/water";
import { nwsAlertsAdapter, type WeatherAlerts } from "@/lib/adapters/nws/alerts";
import { fetchNeighborhoodStats, type NeighborhoodStats } from "@/lib/adapters/census/neighborhood";
import { unavailable, type SourcedValue } from "@/lib/provenance";
import type { NearbySites } from "@/lib/environment/nearby";

export type { NearbySites, NearbySite } from "@/lib/environment/nearby";
export type { WeatherAlerts } from "@/lib/adapters/nws/alerts";
export type { NeighborhoodStats } from "@/lib/adapters/census/neighborhood";

type LatLon = { lat: number | null; lon: number | null };
const noCoords = ({ lat, lon }: LatLon) => lat == null || lon == null;

export async function getEpaSites(lat: number | null, lon: number | null): Promise<SourcedValue<NearbySites>> {
  if (noCoords({ lat, lon })) return unavailable(epaFrsAdapter.sourceLabel);
  return runAdapter(epaFrsAdapter, { lat: lat!, lon: lon! }, { cache: sourceCache });
}

export async function getWaterSystems(lat: number | null, lon: number | null): Promise<SourcedValue<NearbySites>> {
  if (noCoords({ lat, lon })) return unavailable(dohWaterAdapter.sourceLabel);
  return runAdapter(dohWaterAdapter, { lat: lat!, lon: lon! }, { cache: sourceCache });
}

export async function getWeatherAlerts(lat: number | null, lon: number | null): Promise<SourcedValue<WeatherAlerts>> {
  if (noCoords({ lat, lon })) return unavailable(nwsAlertsAdapter.sourceLabel);
  return runAdapter(nwsAlertsAdapter, { lat: lat!, lon: lon! }, { cache: sourceCache });
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
