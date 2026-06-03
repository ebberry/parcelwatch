import { analyzeZoning, incorporatedAnalysis, type ZoningAnalysis } from "./index";
import { getZoning } from "@/lib/adapters/kingcounty/zoning";
import { unavailable, type SourcedValue } from "@/lib/provenance";

export type { ZoningAnalysis, ZoningAnswer, ZoningStandard, ZoningVerdict } from "./index";
export { ZONING_DISCLAIMER } from "./index";

const SOURCE = "King County zoning (DLS Planning) + KCC Title 21A";

/**
 * Authoritative zoning analysis. Zoning comes from King County's **planning**
 * zoning polygon (point-in-polygon), NOT the Assessor's `KCA_ZONING` attribute,
 * which is unreliable and — inside cities — stores the city's code. If the
 * parcel is inside an incorporated city, we say so and do NOT apply the King
 * County Code; otherwise we analyze the authoritative `CURRZONE` against Title
 * 21A. Degrades to "unavailable" when the source is unreachable.
 *
 * `recordedCode` is the Assessor's KCA_ZONING, passed only as a labeled hint for
 * the incorporated case (the city is still the authority).
 */
export async function getZoningAnalysis(
  lat: number | null,
  lon: number | null,
  acres: number | null,
  recordedCode: string | null = null,
): Promise<SourcedValue<ZoningAnalysis>> {
  if (lat == null || lon == null) return unavailable(SOURCE);
  let lookup;
  try {
    lookup = await getZoning(lat, lon);
  } catch {
    return unavailable(SOURCE);
  }
  if (!lookup) return unavailable(SOURCE);

  const now = new Date().toISOString();

  // Incorporated city → King County does not zone it.
  if (lookup.city) {
    return {
      value: incorporatedAnalysis(lookup.city, recordedCode),
      source: `King County zoning (DLS) — parcel is in ${lookup.city}`,
      fetchedAt: now,
      confidence: "confirmed",
    };
  }

  // Unincorporated King County → analyze the authoritative current zone.
  if (lookup.currentZone) {
    return {
      value: analyzeZoning(lookup.currentZone, acres),
      source: SOURCE,
      fetchedAt: now,
      confidence: "confirmed",
    };
  }

  // In unincorporated KC but no mapped zone (rare — e.g. right-of-way): honest.
  return unavailable(SOURCE);
}
