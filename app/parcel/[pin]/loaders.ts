import { cache } from "react";
import { getParcelCore } from "@/lib/parcels/service";
import { getComparables } from "@/lib/comps/service";
import { getSaleComps } from "@/lib/sales/service";
import { buildRecommendation } from "@/lib/appeals";
import { getFloodHazard, getSeismicActivity } from "@/lib/hazards/service";
import { getSiteRisk, getGeoHazards, getSoilContamination } from "@/lib/risk/service";
import { getEpaSites, getWaterSystem, getNeighborhoodStats } from "@/lib/environment/service";
import { getSepticStatus } from "@/lib/adapters/kingcounty/septic";
import { getParcelBoundary } from "@/lib/adapters/kingcounty/boundary";
import { getCivicActivity } from "@/lib/watches/service";
import { resolveArea } from "@/lib/watches/area";
import { getZoningAnalysis } from "@/lib/zoning/service";
import { getSession } from "@/lib/auth";
import { getOwnerInputs } from "@/lib/owner/inputs";
import type { ParcelCore } from "@/lib/adapters/kingcounty";

/**
 * Per-request memoized data loaders for the parcel report.
 *
 * Each panel now fetches its own data inside its own <Suspense> boundary so one
 * slow/flaky government endpoint can't block the rest of the page. React
 * `cache()` dedupes across boundaries: when the synthesis and a panel both need
 * (say) flood or the comps-based recommendation, the work runs once per request.
 *
 * Keyed by primitive args (lat/lon/pin/city) or the single `p` object reference
 * that the page threads to every section — so cache hits are reliable.
 */

export const loadParcel = cache((pin: string) => getParcelCore(pin));

/** Session + the signed-in owner's saved inputs for this parcel (per request). */
export const loadSession = cache(() => getSession());
export const loadOwnerInputs = cache((userId: string, parcelId: string) =>
  getOwnerInputs(userId, parcelId),
);

export const loadFlood = cache((lat: number | null, lon: number | null) =>
  getFloodHazard(lat, lon),
);
export const loadSeismic = cache((lat: number | null, lon: number | null) =>
  getSeismicActivity(lat, lon),
);
export const loadSiteRisk = cache((lat: number | null, lon: number | null) =>
  getSiteRisk(lat, lon),
);
export const loadGeoHazards = cache((lat: number | null, lon: number | null) =>
  getGeoHazards(lat, lon),
);
export const loadSoil = cache((lat: number | null, lon: number | null) =>
  getSoilContamination(lat, lon),
);
export const loadEpa = cache((lat: number | null, lon: number | null) =>
  getEpaSites(lat, lon),
);
export const loadWater = cache((lat: number | null, lon: number | null) =>
  getWaterSystem(lat, lon),
);
export const loadNeighborhood = cache((lat: number | null, lon: number | null) =>
  getNeighborhoodStats(lat, lon),
);
export const loadZoning = cache(
  (lat: number | null, lon: number | null, acres: number | null, recordedCode: string | null) =>
    getZoningAnalysis(lat, lon, acres, recordedCode),
);
export const loadSeptic = cache((pin: string | null) => getSepticStatus(pin));
export const loadBoundary = cache((pin: string | null) => getParcelBoundary(pin));
export const loadCouncil = cache((city: string | null) =>
  getCivicActivity(resolveArea({ city })),
);

export const loadComps = cache((p: ParcelCore) => getComparables(p));
export const loadSales = cache((p: ParcelCore) => getSaleComps(p));

/** Comps + sales → appeal recommendation, computed once per request. */
export const loadRecommendation = cache(async (p: ParcelCore) => {
  const [comp, sale] = await Promise.all([loadComps(p), loadSales(p)]);
  return buildRecommendation({
    assessedTotal: p.assessment?.appraisedTotal ?? null,
    sale: sale?.value ?? null,
    comp: comp?.value ?? null,
  });
});
