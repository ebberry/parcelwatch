import type { DataSourceAdapter, ParcelLookupContext } from "@/lib/adapters/types";
import { haversineKm } from "@/lib/geo";

/**
 * USGS Earthquake Catalog — recent seismic activity near a point.
 *
 * Keyless FDSN GeoJSON API (verified 2026-05-31). We query a radius + time
 * window and compute each quake's distance from the parcel. See
 * /docs/data-sources.md.
 */

const USGS_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query";

export const SEISMIC_RADIUS_KM = 100;
export const SEISMIC_WINDOW_DAYS = 365;
export const SEISMIC_MIN_MAGNITUDE = 2.5;

interface UsgsFeature {
  properties: { mag: number | null; place: string | null; time: number | null; url: string | null };
  geometry: { coordinates: number[] }; // [lon, lat, depthKm]
}
interface UsgsResponse {
  features?: UsgsFeature[];
}

/** Raw carries the query origin so normalize can compute distances purely. */
export interface RawSeismic {
  origin: { lat: number; lon: number };
  response: UsgsResponse;
}

export interface Earthquake {
  magnitude: number | null;
  place: string | null;
  time: string | null; // ISO
  depthKm: number | null;
  distanceKm: number | null;
  url: string | null;
}

export interface SeismicActivity {
  radiusKm: number;
  windowDays: number;
  minMagnitude: number;
  count: number;
  largest: Earthquake | null;
  recent: Earthquake[];
}

export const usgsEarthquakeAdapter: DataSourceAdapter<RawSeismic, SeismicActivity> = {
  id: "usgs.earthquakes",
  sourceLabel: "USGS Earthquake Catalog",
  // Recent activity changes; refresh hourly.
  refreshTtlSeconds: 60 * 60,

  async fetchRaw(input: ParcelLookupContext): Promise<RawSeismic> {
    if (input.lat == null || input.lon == null) {
      throw new Error("USGS earthquake lookup requires coordinates");
    }
    const startMs = Date.now() - SEISMIC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const params = new URLSearchParams({
      format: "geojson",
      latitude: String(input.lat),
      longitude: String(input.lon),
      maxradiuskm: String(SEISMIC_RADIUS_KM),
      starttime: new Date(startMs).toISOString().slice(0, 10),
      minmagnitude: String(SEISMIC_MIN_MAGNITUDE),
      orderby: "time",
      limit: "100",
    });
    const res = await fetch(`${USGS_QUERY}?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`USGS returned HTTP ${res.status}`);
    const response = (await res.json()) as UsgsResponse;
    return { origin: { lat: input.lat, lon: input.lon }, response };
  },

  normalize(raw: RawSeismic): SeismicActivity {
    const quakes: Earthquake[] = (raw.response.features ?? []).map((f) => {
      const [lon, lat, depth] = f.geometry.coordinates;
      return {
        magnitude: f.properties.mag ?? null,
        place: f.properties.place ?? null,
        time: f.properties.time != null ? new Date(f.properties.time).toISOString() : null,
        depthKm: depth ?? null,
        distanceKm:
          lat != null && lon != null
            ? Math.round(haversineKm(raw.origin.lat, raw.origin.lon, lat, lon))
            : null,
        url: f.properties.url ?? null,
      };
    });

    const byTimeDesc = [...quakes].sort((a, b) =>
      (b.time ?? "").localeCompare(a.time ?? ""),
    );
    const largest = quakes.reduce<Earthquake | null>((max, q) => {
      if (q.magnitude == null) return max;
      if (max?.magnitude == null || q.magnitude > max.magnitude) return q;
      return max;
    }, null);

    return {
      radiusKm: SEISMIC_RADIUS_KM,
      windowDays: SEISMIC_WINDOW_DAYS,
      minMagnitude: SEISMIC_MIN_MAGNITUDE,
      count: quakes.length,
      largest,
      recent: byTimeDesc.slice(0, 5),
    };
  },
};
