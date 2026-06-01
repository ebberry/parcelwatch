import { runAdapter } from "@/lib/adapters";
import { sourceCache } from "@/lib/adapters/cache-instance";
import {
  kingCountyParcelAdapter,
  searchParcelsByAddress,
  PIN_RE,
  type ParcelCore,
  type ParcelCandidate,
} from "@/lib/adapters/kingcounty/parcel";
import { unavailable, type SourcedValue } from "@/lib/provenance";

/**
 * Backend-for-frontend service for parcels. The dashboard and API routes call
 * these — they never touch raw adapters or the ArcGIS client directly.
 */

export type { ParcelCore, ParcelCandidate };
export { PIN_RE };

/**
 * Fetch a parcel's core facts as a SourcedValue (carries source + date +
 * confidence). On any failure the value is `unavailable` — never invented.
 */
export async function getParcelCore(
  pin: string,
): Promise<SourcedValue<ParcelCore>> {
  if (!PIN_RE.test(pin)) {
    return unavailable(kingCountyParcelAdapter.sourceLabel);
  }
  return runAdapter(
    kingCountyParcelAdapter,
    { parcelId: pin },
    { cache: sourceCache },
  );
}

/**
 * Resolve a typed address to candidate parcels (the confirm-the-parcel step).
 * Returns an empty list on no match. Distinguishes "source down" from "no
 * results" via the `unavailable` flag so the UI can show the right state.
 */
export async function searchParcels(query: string): Promise<{
  candidates: ParcelCandidate[];
  unavailable: boolean;
}> {
  try {
    const candidates = await searchParcelsByAddress(query);
    return { candidates, unavailable: false };
  } catch {
    // Source unreachable — say so, don't pretend there were zero matches.
    return { candidates: [], unavailable: true };
  }
}
