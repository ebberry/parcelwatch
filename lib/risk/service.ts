import { geocodeTract } from "@/lib/adapters/census/neighborhood";
import { getNriByTract, type SiteRisk } from "@/lib/adapters/fema/nri";
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
