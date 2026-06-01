import { analyzeZoning, type ZoningAnalysis } from "./index";
import { unavailable, type SourcedValue } from "@/lib/provenance";

export type { ZoningAnalysis, ZoningAnswer, ZoningStandard, ZoningVerdict } from "./index";
export { ZONING_DISCLAIMER } from "./index";

/**
 * Zoning analysis as a SourcedValue. The verdicts are computed from the King
 * County Code (confidence "confirmed", with the inputs — zoning code + lot size
 * — coming from the live county data shown elsewhere on the page). When there's
 * no zoning code, the source is honestly "unavailable".
 */
export function getZoningAnalysis(
  zoningCode: string | null,
  acres: number | null,
  now: Date = new Date(),
): SourcedValue<ZoningAnalysis> {
  if (!zoningCode) {
    return unavailable("King County Code (Title 21A)");
  }
  return {
    value: analyzeZoning(zoningCode, acres),
    source: "Computed from King County Code (Title 21A)",
    fetchedAt: now.toISOString(),
    confidence: "confirmed",
  };
}
