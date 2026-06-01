import type { CompSet } from "@/lib/comps/service";

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
  { key: "uniformity", label: "Assessment is higher than comparable nearby properties" },
  { key: "condition", label: "Property condition issues reduce its value" },
  { key: "purchase", label: "A recent purchase price was lower than the assessed value" },
  { key: "errors", label: "Factual errors in the county's property record" },
  { key: "other", label: "Other reason (explain below)" },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

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
