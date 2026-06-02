import { geocodeTract } from "@/lib/adapters/census/neighborhood";
import { getNriByTract, type SiteRisk } from "@/lib/adapters/fema/nri";
import { getSensitiveAreas } from "@/lib/adapters/kingcounty/sensitiveAreas";
import { getLiquefaction } from "@/lib/adapters/wadnr/liquefaction";
import { unavailable, type SourcedValue } from "@/lib/provenance";

export type { SiteRisk, NriHazard } from "@/lib/adapters/fema/nri";

const SOURCE = "FEMA National Risk Index (v1.20)";

/**
 * Site risk = FEMA NRI for the parcel's census tract. We derive the tract from
 * coords (same keyless Census geocoder as the Neighborhood panel), then query
 * the NRI feature service. Degrades to unavailable without coords/tract/data.
 */
export async function getSiteRisk(
  lat: number | null,
  lon: number | null,
): Promise<SourcedValue<SiteRisk>> {
  if (lat == null || lon == null) return unavailable(SOURCE);
  try {
    const t = await geocodeTract(lat, lon);
    if (!t) return unavailable(SOURCE);
    const geoid = `${t.state}${t.county}${t.tract}`;
    const risk = await getNriByTract(geoid);
    if (!risk) return unavailable(SOURCE);
    return {
      value: { ...risk, tractName: risk.tractName ?? t.name },
      source: SOURCE,
      fetchedAt: new Date().toISOString(),
      confidence: "live",
    };
  } catch {
    return unavailable(SOURCE);
  }
}

const GEO_SOURCE = "King County critical areas + WA DNR geology";

export interface GeoHazards {
  /** KC mapped critical-area hazards the parcel falls in (regulatory). */
  criticalAreas: string[];
  /** WA DNR liquefaction susceptibility class at the point. */
  liquefaction: string | null;
}

/**
 * Site-specific geologic/critical-area hazards: which KC mapped hazard areas the
 * parcel is in (landslide, steep slope, erosion, …) plus DNR liquefaction
 * susceptibility. These carry regulatory weight — distinct from the NRI's
 * tract-level relative index. Each source degrades independently.
 */
export async function getGeoHazards(
  lat: number | null,
  lon: number | null,
): Promise<SourcedValue<GeoHazards>> {
  if (lat == null || lon == null) return unavailable(GEO_SOURCE);
  const [areas, liq] = await Promise.all([
    getSensitiveAreas(lat, lon).catch(() => null),
    getLiquefaction(lat, lon).catch(() => null),
  ]);
  // Both down → unavailable; otherwise report what we have.
  if (areas == null && liq == null) return unavailable(GEO_SOURCE);
  return {
    value: { criticalAreas: areas ?? [], liquefaction: liq },
    source: GEO_SOURCE,
    fetchedAt: new Date().toISOString(),
    confidence: "live",
  };
}
