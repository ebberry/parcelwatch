import { runAdapter } from "@/lib/adapters";
import { sourceCache } from "@/lib/adapters/cache-instance";
import { femaFloodAdapter, type FloodHazard } from "@/lib/adapters/fema";
import { usgsEarthquakeAdapter, type SeismicActivity } from "@/lib/adapters/usgs";
import { unavailable, type SourcedValue } from "@/lib/provenance";

export type { FloodHazard } from "@/lib/adapters/fema";
export type { SeismicActivity, Earthquake } from "@/lib/adapters/usgs";

/** FEMA flood hazard at the parcel point. Unavailable without coordinates. */
export async function getFloodHazard(
  lat: number | null,
  lon: number | null,
): Promise<SourcedValue<FloodHazard>> {
  if (lat == null || lon == null) {
    return unavailable(femaFloodAdapter.sourceLabel);
  }
  return runAdapter(femaFloodAdapter, { lat, lon }, { cache: sourceCache });
}

/** Recent earthquakes near the parcel. Unavailable without coordinates. */
export async function getSeismicActivity(
  lat: number | null,
  lon: number | null,
): Promise<SourcedValue<SeismicActivity>> {
  if (lat == null || lon == null) {
    return unavailable(usgsEarthquakeAdapter.sourceLabel);
  }
  return runAdapter(usgsEarthquakeAdapter, { lat, lon }, { cache: sourceCache });
}
