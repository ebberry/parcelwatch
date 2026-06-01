import { searchComparables, type RawComparable } from "@/lib/adapters/kingcounty/comparables";
import type { ParcelCore } from "@/lib/adapters/kingcounty/parcel";
import { haversineKm } from "@/lib/geo";
import { unavailable, type SourcedValue } from "@/lib/provenance";

/**
 * Comparable-assessment engine for the appeals feature (and the shareable
 * comparison card). Pulls nearby same-use parcels, normalizes assessed value by
 * lot size, and compares the subject to the neighborhood median.
 *
 * Honest framing: this is assessment-UNIFORMITY evidence, not recent sales, and
 * the per-lot-sqft metric is a rough screen (it doesn't capture building size or
 * condition). Never a modeled valuation. See /docs/DECISIONS.md.
 */

export interface Comparable {
  pin: string;
  address: string | null;
  lotSqFt: number | null;
  assessedTotal: number | null;
  perLotSqFt: number | null;
  distanceKm: number | null;
}

export interface CompSet {
  presentUse: string | null;
  radiusMeters: number;
  subject: { assessedTotal: number | null; lotSqFt: number | null; perLotSqFt: number | null };
  comps: Comparable[];
  medianAssessedTotal: number | null;
  medianPerLotSqFt: number | null;
  /** Subject's per-sqft assessment vs the comp median, as a percentage (+ = higher). */
  subjectVsMedianPct: number | null;
  /** Heuristic: subject assessed meaningfully above comparable homes per sqft. */
  appearsHigh: boolean;
}

const RADIUS_METERS = 1600; // ~1 mile
const TARGET_COMPS = 8;

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Pure stats step (exported for tests): pick lot-size-similar comps, normalize,
 * and compare the subject to the median.
 */
export function buildCompSet(
  subject: ParcelCore,
  raw: RawComparable[],
): CompSet {
  const subjLot = subject.lotSqFt ?? null;
  const subjTotal = subject.assessment?.appraisedTotal ?? null;
  const subjPerSqFt =
    subjTotal != null && subjLot && subjLot > 0 ? subjTotal / subjLot : null;

  // Keep comps with usable values and a roughly similar lot size (0.4x–2.5x).
  const usable = raw.filter(
    (c) =>
      c.assessedTotal != null &&
      c.lotSqFt != null &&
      c.lotSqFt > 0 &&
      (subjLot == null || (c.lotSqFt >= subjLot * 0.4 && c.lotSqFt <= subjLot * 2.5)),
  );

  const comps: Comparable[] = usable
    .map((c) => ({
      pin: c.pin,
      address: c.address,
      lotSqFt: c.lotSqFt,
      assessedTotal: c.assessedTotal,
      perLotSqFt: c.assessedTotal! / c.lotSqFt!,
      distanceKm:
        subject.lat != null && subject.lon != null && c.lat != null && c.lon != null
          ? Math.round(haversineKm(subject.lat, subject.lon, c.lat, c.lon) * 10) / 10
          : null,
    }))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .slice(0, TARGET_COMPS);

  const medianTotal = median(comps.map((c) => c.assessedTotal!).filter((n) => n != null));
  const medianPerSqFt = median(comps.map((c) => c.perLotSqFt!).filter((n) => n != null));
  const vsPct =
    subjPerSqFt != null && medianPerSqFt
      ? Math.round(((subjPerSqFt - medianPerSqFt) / medianPerSqFt) * 100)
      : null;

  return {
    presentUse: subject.presentUse,
    radiusMeters: RADIUS_METERS,
    subject: { assessedTotal: subjTotal, lotSqFt: subjLot, perLotSqFt: subjPerSqFt },
    comps,
    medianAssessedTotal: medianTotal,
    medianPerLotSqFt: medianPerSqFt,
    subjectVsMedianPct: vsPct,
    appearsHigh: vsPct != null && vsPct >= 10,
  };
}

/** Fetch + analyze comparables for a parcel. Unavailable without coords/use/value. */
export async function getComparables(
  subject: ParcelCore,
): Promise<SourcedValue<CompSet>> {
  const source = "King County Assessor (comparable parcels)";
  if (
    subject.lat == null ||
    subject.lon == null ||
    subject.presentUseCode == null ||
    subject.assessment?.appraisedTotal == null
  ) {
    return unavailable(source);
  }
  try {
    const raw = await searchComparables({
      lat: subject.lat,
      lon: subject.lon,
      preuseCode: subject.presentUseCode,
      excludePin: subject.pin,
      radiusMeters: RADIUS_METERS,
      limit: 50,
    });
    const set = buildCompSet(subject, raw);
    if (!set.comps.length) return unavailable(source);
    return {
      value: set,
      source,
      fetchedAt: new Date().toISOString(),
      confidence: "live",
    };
  } catch {
    return unavailable(source);
  }
}
