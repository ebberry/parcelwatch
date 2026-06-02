/**
 * WA Dept of Ecology — Tacoma Smelter Plume footprint (point-in-polygon).
 *
 * The former ASARCO smelter in Tacoma deposited arsenic and lead across ~1,000
 * sq mi of the Puget Sound basin, including all of Vashon-Maury. Ecology models
 * estimated surface-soil arsenic into concentration bands; we report which band
 * the parcel's point falls in. This is a *modeled* estimate (90% confidence that
 * ≥1 in 10 parcels meets/exceeds the band), not a measured soil test — labeled
 * as such. Reference levels: 20 ppm arsenic = state cleanup level; 100 ppm
 * arsenic = residential-yard action level (free testing + cleanup may apply).
 *
 * Why the footprint polygon (layer 1), not the cleanup-sites points (layer 0):
 * the point layer's lat/lon is the responsible-party address, not the
 * contamination area. The footprint is a true polygon — reliable point-in-polygon.
 */

const PLUME_QUERY =
  "https://services.arcgis.com/6lCKYNJLvwTXqrmp/arcgis/rest/services/TCP/FeatureServer/1/query";

/** How a band relates to the published reference levels. Pure, testable. */
export type PlumeSeverity =
  | "above-action" // ≥ 100 ppm residential action level
  | "above-cleanup" // ≥ 20 ppm cleanup level, < 100 ppm
  | "below-cleanup" // < 20 ppm
  | "unmodeled"; // Limited Data / state facility — no estimate

export interface SmelterPlume {
  /** Modeled arsenic band, verbatim from Ecology, e.g. "Over 100 ppm". */
  band: string;
  severity: PlumeSeverity;
  /** Miles from the former ASARCO smelter (a model input), when present. */
  milesFromSmelter: number | null;
}

/** Classify Ecology's band name against the published reference levels. Pure. */
export function classifyPlumeBand(name: string | null | undefined): PlumeSeverity {
  switch ((name ?? "").trim()) {
    case "Over 100 ppm":
      return "above-action";
    case "20 ppm to 40 ppm":
    case "40.1 ppm to 100 ppm":
      return "above-cleanup";
    case "Under 20 ppm":
      return "below-cleanup";
    default:
      // "Limited Data", "Military Base/State Facility", anything unexpected.
      return "unmodeled";
  }
}

export async function getSmelterPlume(
  lat: number | null,
  lon: number | null,
): Promise<SmelterPlume | null> {
  if (lat == null || lon == null) return null;
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326", // server reprojects from WA State Plane (wkid 2927)
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME,MILES_FROM",
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${PLUME_QUERY}?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 * 30 }, // footprint is ~static
  });
  if (!res.ok) throw new Error(`smelter plume ${res.status}`);
  const data = (await res.json()) as {
    features?: { attributes: { NAME?: string; MILES_FROM?: number } }[];
    error?: unknown;
  };
  if (data.error) throw new Error("smelter plume query error");
  const a = data.features?.[0]?.attributes;
  if (!a?.NAME) return null; // outside the modeled footprint
  return {
    band: a.NAME,
    severity: classifyPlumeBand(a.NAME),
    milesFromSmelter: typeof a.MILES_FROM === "number" ? a.MILES_FROM : null,
  };
}
