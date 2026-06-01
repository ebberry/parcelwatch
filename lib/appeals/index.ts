import type { CompSet } from "@/lib/comps/service";
import type { SaleCompSet } from "@/lib/sales/service";

/**
 * Assisted assessed-value appeal preparation. We pre-fill the official King
 * County Board of Equalization petition and hand off to the eAppeals portal —
 * the owner reviews and files. We never submit on their behalf (no BOE API; a
 * quasi-legal filing stays the owner's to make). Verified 2026-05-31.
 */

/** King County eAppeals online filing portal (owner login required). */
export const EAPPEALS_URL =
  "https://blue.kingcounty.gov/assessor/eappeals/RPLookup.aspx";

/** Official BOE petition forms (for mail filing). */
export const BOE_FORMS_URL =
  "https://kingcounty.gov/en/independents/governance-and-leadership/government-oversight/board-appeals-equalization/appeals-forms";

export interface AppealReason {
  key: string;
  label: string;
}

export const APPEAL_REASONS: AppealReason[] = [
  { key: "market", label: "Assessed value is higher than recent comparable sales" },
  { key: "uniformity", label: "Assessment is higher than comparable nearby properties" },
  { key: "purchase", label: "A recent purchase price was lower than the assessed value" },
  { key: "condition", label: "Property condition issues reduce its value" },
  { key: "errors", label: "Factual errors in the county's property record" },
  { key: "other", label: "Other reason (explain below)" },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Format an ISO date (YYYY-MM-DD) as e.g. "August 2025". */
function monthYear(iso: string | null): string {
  if (!iso) return "an earlier date";
  const [y, m] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return m >= 1 && m <= 12 ? `${months[m - 1]} ${y}` : String(y);
}

/**
 * A suggested, editable "grounds for appeal" paragraph built from the comparable
 * -assessment evidence. Returns null when the comps don't support a uniformity
 * argument (we never manufacture a claim the data doesn't back).
 */
export function buildUniformityNarrative(comp: CompSet): string | null {
  if (
    !comp.appearsHigh ||
    comp.subjectVsMedianPct == null ||
    comp.medianPerLotSqFt == null ||
    comp.subject.perLotSqFt == null ||
    comp.comps.length === 0
  ) {
    return null;
  }
  const use = comp.presentUse ? comp.presentUse.toLowerCase() : "comparable";
  return (
    `King County's own assessment records indicate this property is valued at approximately ${usd(comp.subject.perLotSqFt)} per lot square foot — about ${comp.subjectVsMedianPct}% above the median of ${comp.comps.length} comparable ${use} properties within about a mile (median ≈ ${usd(comp.medianPerLotSqFt)} per lot square foot). ` +
    `This indicates the assessment may not be uniform and equitable relative to similar nearby properties, which supports a reduction in the assessed value. ` +
    `(Per-lot-square-foot is a starting screen; supporting evidence such as recent comparable sales, building size, and property condition should also be considered.)`
  );
}

/**
 * Market-value "grounds" paragraph built from recent comparable SALES — the
 * strongest WA appeal argument (RCW 84.40.0301). Returns null unless the
 * assessment materially exceeds the comparable sales.
 */
export function buildMarketValueNarrative(sale: SaleCompSet): string | null {
  if (
    !sale.appearsHigh ||
    sale.medianSalePrice == null ||
    sale.assessedVsMedianSalePct == null ||
    sale.subjectAssessedTotal == null ||
    sale.comps.length === 0
  ) {
    return null;
  }
  const window =
    sale.earliestSale && sale.latestSale
      ? `between ${monthYear(sale.earliestSale)} and ${monthYear(sale.latestSale)}`
      : "within the last three years";
  const range =
    sale.lowSalePrice != null && sale.highSalePrice != null
      ? ` (ranging from ${usd(sale.lowSalePrice)} to ${usd(sale.highSalePrice)})`
      : "";
  const ratio =
    sale.medianAssessedToSalePct != null
      ? `For comparison, those nearby homes are assessed at a median of about ${sale.medianAssessedToSalePct}% of their actual sale price. `
      : "";
  return (
    `${sale.comps.length} comparable properties within about a mile sold ${window} for a median of ${usd(sale.medianSalePrice)}${range}. ` +
    `The assessed value of ${usd(sale.subjectAssessedTotal)} is about ${sale.assessedVsMedianSalePct}% above that median, indicating the assessment likely exceeds the property's true and fair market value (RCW 84.40.0301). ` +
    ratio +
    `Recent arm's-length sales of similar nearby property are the best evidence of market value and support a reduction in the assessed value. ` +
    `(These recorded sales are not adjusted for building size or condition; see the attached comparable-homes schedule.)`
  );
}

/**
 * "Recent purchase" paragraph — when the owner's own recorded purchase came in
 * below the assessed value (very strong evidence). Returns null otherwise.
 */
export function buildRecentPurchaseNarrative(sale: SaleCompSet): string | null {
  const s = sale.subjectSale;
  if (
    !s ||
    s.belowAssessedPct == null ||
    s.belowAssessedPct < 5 ||
    sale.subjectAssessedTotal == null
  ) {
    return null;
  }
  return (
    `This property last sold in ${monthYear(s.saleDate)} for ${usd(s.salePrice)}, about ${s.belowAssessedPct}% below the assessed value of ${usd(sale.subjectAssessedTotal)}. ` +
    `A recent arm's-length purchase price is strong evidence of true and fair market value (RCW 84.40.0301) and supports reducing the assessment toward the sale price.`
  );
}

/**
 * Assemble the default, editable explanation from whatever evidence is
 * available, strongest argument first (recent purchase → market sales →
 * uniformity), and the appeal-reason checkboxes those arguments imply. We never
 * include a claim the data doesn't support; an empty result means "owner writes
 * their own grounds".
 */
export function buildAppealNarrative(input: {
  comp: CompSet | null;
  sale: SaleCompSet | null;
}): { text: string | null; reasons: string[] } {
  const parts: string[] = [];
  const reasons: string[] = [];

  const purchase = input.sale ? buildRecentPurchaseNarrative(input.sale) : null;
  if (purchase) {
    parts.push(purchase);
    reasons.push("purchase");
  }
  const market = input.sale ? buildMarketValueNarrative(input.sale) : null;
  if (market) {
    parts.push(market);
    reasons.push("market");
  }
  const uniformity = input.comp ? buildUniformityNarrative(input.comp) : null;
  if (uniformity) {
    parts.push(uniformity);
    reasons.push("uniformity");
  }

  return { text: parts.length ? parts.join("\n\n") : null, reasons };
}

// ---------------------------------------------------------------------------
// Recommendation engine — turns the evidence into a concrete value to request.
// ---------------------------------------------------------------------------

export type AppealStrength = "strong" | "moderate" | "weak" | "none";

/** One real, cited data point that indicates value (never a model output). */
export interface ValueIndicator {
  key: "purchase" | "sales" | "uniformity";
  label: string;
  value: number;
}

export interface AppealRecommendation {
  /** The evidence supports a meaningful reduction (≥5%). */
  shouldAppeal: boolean;
  strength: AppealStrength;
  currentAssessed: number | null;
  /** The value to request on the petition (rounded). Anchored on ONE real indicator. */
  recommendedValue: number | null;
  /** Defensible range across the available indicators that fall below assessed. */
  rangeLow: number | null;
  rangeHigh: number | null;
  /** Human label of the primary indicator the recommendation is anchored on. */
  basis: string | null;
  reductionAmount: number | null;
  reductionPct: number | null;
  /** Every available indicator, for transparency. */
  indicators: ValueIndicator[];
  caveats: string[];
}

const CAVEATS = [
  "These figures use recorded sales and county assessments, not a formal appraisal — you choose the value to request.",
  "Comparable sales are not adjusted for building size or condition.",
  "Sale dates and the assessment date may differ.",
];

const roundTo1k = (n: number) => Math.round(n / 1000) * 1000;

/**
 * Recommend what to request on the appeal. We anchor the figure on a SINGLE
 * real, cited indicator — strongest first: the owner's own recent purchase, then
 * the median of comparable sales, then the per-lot-sqft assessment screen — and
 * never blend them into a synthetic valuation. We only recommend appealing when
 * the assessed value exceeds the indicator by a meaningful margin.
 */
export function buildRecommendation(input: {
  assessedTotal: number | null;
  sale: SaleCompSet | null;
  comp: CompSet | null;
}): AppealRecommendation {
  const assessed = input.assessedTotal;
  const indicators: ValueIndicator[] = [];

  const purchase = input.sale?.subjectSale ?? null;
  if (purchase) {
    indicators.push({
      key: "purchase",
      label: `your ${monthYear(purchase.saleDate)} purchase price (${usd(purchase.salePrice)})`,
      value: purchase.salePrice,
    });
  }
  const salesMedian = input.sale?.medianSalePrice ?? null;
  const nComps = input.sale?.comps.length ?? 0;
  if (salesMedian != null && nComps > 0) {
    indicators.push({
      key: "sales",
      label: `the median of ${nComps} comparable sale${nComps === 1 ? "" : "s"} (${usd(salesMedian)})`,
      value: salesMedian,
    });
  }
  const uniformityImplied =
    input.comp?.medianPerLotSqFt != null && input.comp.subject.lotSqFt != null
      ? input.comp.medianPerLotSqFt * input.comp.subject.lotSqFt
      : null;
  if (uniformityImplied != null) {
    indicators.push({
      key: "uniformity",
      label: "comparable assessments (per lot square foot)",
      value: uniformityImplied,
    });
  }

  const base: AppealRecommendation = {
    shouldAppeal: false,
    strength: "none",
    currentAssessed: assessed,
    recommendedValue: null,
    rangeLow: null,
    rangeHigh: null,
    basis: null,
    reductionAmount: null,
    reductionPct: null,
    indicators,
    caveats: CAVEATS,
  };
  if (assessed == null || assessed <= 0 || !indicators.length) return base;

  // Anchor on the strongest available indicator — never an average of them.
  const primary =
    indicators.find((i) => i.key === "purchase") ??
    indicators.find((i) => i.key === "sales") ??
    indicators[0];

  const recommendedValue = roundTo1k(primary.value);
  const reductionAmount = assessed - recommendedValue;
  const reductionPct = Math.round((reductionAmount / assessed) * 100);
  const shouldAppeal = reductionAmount > 0 && reductionPct >= 5;

  const below = indicators.map((i) => i.value).filter((v) => v < assessed);
  const rangeLow = below.length ? roundTo1k(Math.min(...below)) : null;
  const rangeHigh = below.length ? roundTo1k(Math.max(...below)) : null;

  let strength: AppealStrength = "none";
  if (shouldAppeal) {
    const corroborating = below.length; // how many indicators independently agree
    if (
      (primary.key === "purchase" && reductionPct >= 10) ||
      (primary.key === "sales" && nComps >= 5 && reductionPct >= 15)
    ) {
      strength = "strong";
    } else if (reductionPct >= 10 || corroborating >= 2) {
      strength = "moderate";
    } else {
      strength = "weak";
    }
  }

  return {
    ...base,
    shouldAppeal,
    strength,
    recommendedValue,
    rangeLow,
    rangeHigh,
    basis: primary.label,
    reductionAmount,
    reductionPct,
  };
}

/**
 * An editable, first-person request line for the petition's explanation,
 * naming the value to request and what it's based on. Null when no appeal is
 * recommended (we never put a manufactured request in the owner's mouth).
 */
export function buildRequestSentence(rec: AppealRecommendation): string | null {
  if (!rec.shouldAppeal || rec.recommendedValue == null || rec.currentAssessed == null) {
    return null;
  }
  return (
    `I respectfully request that the assessed value be reduced from ${usd(rec.currentAssessed)} ` +
    `to approximately ${usd(rec.recommendedValue)}, based on ${rec.basis}.`
  );
}
