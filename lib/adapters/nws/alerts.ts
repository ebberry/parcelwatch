import type { DataSourceAdapter, ParcelLookupContext } from "@/lib/adapters/types";

/**
 * National Weather Service — active alerts (watches/warnings/advisories) at a
 * point. Keyless GeoJSON API, verified 2026-05-31. NWS requires a descriptive
 * User-Agent header.
 */

const NWS_ALERTS = "https://api.weather.gov/alerts/active";
const USER_AGENT = "ParcelWatch/0.1 (parcelwatch.app; support@parcelwatch.app)";

interface NwsFeature {
  properties: {
    event: string | null;
    severity: string | null;
    headline: string | null;
    areaDesc: string | null;
    effective: string | null;
    expires: string | null;
    ends: string | null;
  };
}
interface NwsResponse {
  features?: NwsFeature[];
}

export interface WeatherAlert {
  event: string | null;
  severity: string | null;
  headline: string | null;
  area: string | null;
  expires: string | null;
}

export interface WeatherAlerts {
  count: number;
  alerts: WeatherAlert[];
}

export const nwsAlertsAdapter: DataSourceAdapter<NwsResponse, WeatherAlerts> = {
  id: "nws.alerts",
  sourceLabel: "National Weather Service",
  // Active alerts change quickly.
  refreshTtlSeconds: 15 * 60,

  async fetchRaw(input: ParcelLookupContext): Promise<NwsResponse> {
    if (input.lat == null || input.lon == null) throw new Error("coords required");
    const url = `${NWS_ALERTS}?point=${input.lat},${input.lon}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`NWS returned HTTP ${res.status}`);
    return (await res.json()) as NwsResponse;
  },

  normalize(raw: NwsResponse): WeatherAlerts {
    const alerts: WeatherAlert[] = (raw.features ?? []).map((f) => ({
      event: f.properties.event ?? null,
      severity: f.properties.severity ?? null,
      headline: f.properties.headline ?? null,
      area: f.properties.areaDesc ?? null,
      expires: f.properties.expires ?? f.properties.ends ?? null,
    }));
    return { count: alerts.length, alerts };
  },
};
