import {
  searchNearbySales,
  getSalesByPin,
  type RawSale,
} from "@/lib/adapters/kingcounty/sales";
import type { ParcelCore } from "@/lib/adapters/kingcounty/parcel";
import { haversineKm } from "@/lib/geo";
import { unavailable, type SourcedValue } from "@/lib/provenance";

/**
 * Comparable-SALES engine for the appeals feature — the market-value evidence.
 * Pulls recent recorded sales of similar nearby properties and compares the
 * subject's assessed value to the median sale price.
 *
 * Honest framing: these are REAL recorded sales (excise records), the strongest
 * appeal evidence under WA law (RCW 84.40.0301 — true and fair market value).
 * They are NOT size-normalized — King County publishes no keyless living-area
 * feed — so this is a market screen, not a formal appraisal. Never modeled.
 */

export interface SaleComp {
  pin: string;
  address: string | null;
  saleDate: string | null;
  salePrice: number | null;
  propertyType: string | null;
  improved: boolean;
  distanceKm: number | null;
}

/** The subject parcel's own most recent qualifying sale, if any. */
export interface SubjectSale {
  saleDate: string | null;
  salePrice: number;
  /** Assessed total minus this sale price, as % of assessed (+ = assessed higher). */
  belowAssessedPct: number | null;
}

export interface SaleCompSet {
  radiusMeters: number;
  comps: SaleComp[];
  /** Earliest / latest sale date among the comps (for an honest window label). */
  earliestSale: string | null;
  latestSale: string | null;
  medianSalePrice: number | null;
  lowSalePrice: number | null;
  highSalePrice: number | null;
  subjectAssessedTotal: number | null;
  /** Subject assessed vs comparable median sale, as % (+ = assessed above market). */
  assessedVsMedianSalePct: number | null;
  /** Heuristic: assessed value materially exceeds comparable sale prices. */
  appearsHigh: boolean;
  /** The subject's own recent sale (the "recent purchase" argument), if found. */
  subjectSale: SubjectSale | null;
}

const RADIUS_METERS = 1600; // ~1 mile
const TARGET_COMPS = 8;
const MATERIAL_PCT = 10;

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Which sale `Principal_Use` values count as comparable to the subject, and
 * whether the subject is improved (built-on) vs vacant land. null = no filter.
 */
function subjectProfile(subject: ParcelCore): {
  keepUses: string[] | null;
  improved: boolean | null;
} {
  const use = (subject.presentUse ?? "").toLowerCase();
  const type = (subject.propertyType ?? "").toUpperCase();
  let keepUses: string[] | null;
  if (/condo/.test(use) || type === "K") {
    keepUses = ["CONDOMINIUM", "RESIDENTIAL"];
  } else if (
    /res|family|residential|townhouse|duplex|triplex|fourplex|plex|mobile|apartment/.test(
      use,
    ) ||
    type === "R"
  ) {
    keepUses = ["RESIDENTIAL"];
  } else if (/commercial|office|retail|industrial|warehouse/.test(use)) {
    keepUses = ["COMMERCIAL"];
  } else {
    keepUses = null;
  }

  const impr = subject.assessment?.appraisedImprovement;
  const improved = impr == null ? null : impr > 0;
  return { keepUses, improved };
}

/**
 * Pure stats step (exported for tests): filter to comparable sales, sort by
 * proximity, summarize, and compare the subject's assessment to the median sale.
 */
export function buildSaleCompSet(
  subject: ParcelCore,
  rawNearby: RawSale[],
  rawSubjectSales: RawSale[] = [],
): SaleCompSet {
  const { keepUses, improved } = subjectProfile(subject);
  const assessed = subject.assessment?.appraisedTotal ?? null;

  let pool = rawNearby.filter(
    (s) => s.salePrice != null && s.salePrice > 0 && s.saleDate != null,
  );
  if (keepUses) {
    pool = pool.filter((s) => s.principalUse != null && keepUses.includes(s.principalUse));
  }
  // Prefer same improved/vacant class — but only if it leaves enough comps.
  if (improved != null) {
    const matched = pool.filter((s) => s.improved === improved);
    if (matched.length >= 3) pool = matched;
  }

  const comps: SaleComp[] = pool
    .map((s) => ({
      pin: s.pin,
      address: s.address,
      saleDate: s.saleDate,
      salePrice: s.salePrice,
      propertyType: s.propertyType,
      improved: s.improved,
      distanceKm:
        subject.lat != null && subject.lon != null && s.lat != null && s.lon != null
          ? Math.round(haversineKm(subject.lat, subject.lon, s.lat, s.lon) * 10) / 10
          : null,
    }))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .slice(0, TARGET_COMPS);

  const prices = comps.map((c) => c.salePrice!).filter((n) => n != null);
  const medianSale = median(prices);
  const dates = comps.map((c) => c.saleDate!).filter(Boolean).sort();

  const vsPct =
    assessed != null && medianSale && medianSale > 0
      ? Math.round(((assessed - medianSale) / medianSale) * 100)
      : null;

  // Subject's own most recent qualifying sale.
  const ownSale = rawSubjectSales
    .filter((s) => s.salePrice != null && s.salePrice > 0 && s.saleDate != null)
    .sort((a, b) => (b.saleDate! < a.saleDate! ? -1 : 1))[0];
  const subjectSale: SubjectSale | null = ownSale
    ? {
        saleDate: ownSale.saleDate,
        salePrice: ownSale.salePrice!,
        belowAssessedPct:
          assessed != null && assessed > 0
            ? Math.round(((assessed - ownSale.salePrice!) / assessed) * 100)
            : null,
      }
    : null;

  return {
    radiusMeters: RADIUS_METERS,
    comps,
    earliestSale: dates[0] ?? null,
    latestSale: dates[dates.length - 1] ?? null,
    medianSalePrice: medianSale,
    lowSalePrice: prices.length ? Math.min(...prices) : null,
    highSalePrice: prices.length ? Math.max(...prices) : null,
    subjectAssessedTotal: assessed,
    assessedVsMedianSalePct: vsPct,
    appearsHigh: vsPct != null && vsPct >= MATERIAL_PCT,
    subjectSale,
  };
}

/** Fetch + analyze comparable sales for a parcel. Unavailable without coords. */
export async function getSaleComps(
  subject: ParcelCore,
): Promise<SourcedValue<SaleCompSet>> {
  const source = "King County recorded sales (last 3 years)";
  if (subject.lat == null || subject.lon == null) {
    return unavailable(source);
  }
  try {
    const [nearby, own] = await Promise.all([
      searchNearbySales({
        lat: subject.lat,
        lon: subject.lon,
        radiusMeters: RADIUS_METERS,
        excludePin: subject.pin,
        limit: 60,
      }),
      getSalesByPin(subject.pin).catch(() => [] as RawSale[]),
    ]);
    const set = buildSaleCompSet(subject, nearby, own);
    if (!set.comps.length && !set.subjectSale) return unavailable(source);
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
