import type { AppealRecommendation } from "@/lib/appeals";
import type { FloodHazard } from "@/lib/adapters/fema";
import type { SeismicActivity } from "@/lib/adapters/usgs";
import type { NearbySites } from "@/lib/environment/nearby";
import type { TaxCalendar } from "@/lib/tax/deadlines";

/**
 * "What matters here" — synthesize the few findings that actually deserve the
 * owner's attention for THIS parcel, from the data the report already fetched.
 * Pure + testable. The report leads with these so it reads as "here's what to
 * care about", not a flat list of facts.
 *
 * Honest by construction: every finding is derived from a real signal; when
 * none clears the bar we say so ("all clear") rather than inventing urgency.
 */

export type FindingTone = "opportunity" | "attention" | "info" | "clear";

export interface Finding {
  id: string;
  tone: FindingTone;
  title: string;
  /** In-page anchor to the section that explains it. */
  href?: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** How many findings we'll surface before it stops being a summary. */
const MAX_FINDINGS = 4;

export function summarizeFindings(input: {
  recommendation: AppealRecommendation | null;
  flood: FloodHazard | null;
  seismic: SeismicActivity | null;
  epa: NearbySites | null;
  councilCount: number;
  tax: TaxCalendar | null;
}): Finding[] {
  const ranked: { priority: number; finding: Finding }[] = [];

  // 1. The money opportunity — our highest-value, most actionable signal.
  const rec = input.recommendation;
  if (rec?.shouldAppeal && rec.reductionAmount != null && rec.reductionPct != null) {
    ranked.push({
      priority: 0,
      finding: {
        id: "appeal",
        tone: "opportunity",
        href: "#appeal",
        title: `You may be over-assessed — an appeal could lower it about ${usd(rec.reductionAmount)} (${rec.reductionPct}%)`,
      },
    });
  }

  // 2. Flood risk — the clearest "attention" signal.
  if (input.flood?.inSFHA === true) {
    const zone = input.flood.floodZone;
    ranked.push({
      priority: 1,
      finding: {
        id: "flood",
        tone: "attention",
        href: "#flood",
        title: `In a high-risk flood zone${zone ? ` (Zone ${zone})` : ""}`,
      },
    });
  }

  // 3. A tax payment coming due within 30 days.
  const next = input.tax?.next;
  if (next && next.daysAway >= 0 && next.daysAway <= 30) {
    ranked.push({
      priority: 2,
      finding: {
        id: "tax",
        tone: next.daysAway <= 14 ? "attention" : "info",
        href: "#tax",
        title: `${next.label} due ${next.dateLabel} — ${next.daysAway} day${next.daysAway === 1 ? "" : "s"} away`,
      },
    });
  }

  // 4. A regulated site genuinely close (≤ half a mile), not just "within 2 mi".
  const nearest = input.epa?.nearest?.[0];
  if (input.epa && input.epa.count > 0 && nearest?.distanceMi != null && nearest.distanceMi <= 0.5) {
    ranked.push({
      priority: 3,
      finding: {
        id: "epa",
        tone: "info",
        href: "#epa",
        title: `EPA-regulated site ${nearest.distanceMi.toFixed(1)} mi away (${input.epa.count} within 2 mi)`,
      },
    });
  }

  // 5. Local government activity worth a glance ("what's changing around it").
  if (input.councilCount > 0) {
    ranked.push({
      priority: 4,
      finding: {
        id: "activity",
        tone: "info",
        href: "#activity",
        title: `${input.councilCount} recent county council item${input.councilCount === 1 ? "" : "s"} to review`,
      },
    });
  }

  // 6. A notable recent earthquake (background micro-quakes don't qualify).
  const largest = input.seismic?.largest;
  if (largest?.magnitude != null && largest.magnitude >= 4) {
    ranked.push({
      priority: 5,
      finding: {
        id: "seismic",
        tone: "info",
        href: "#seismic",
        title: `Recent magnitude ${largest.magnitude.toFixed(1)} earthquake nearby`,
      },
    });
  }

  ranked.sort((a, b) => a.priority - b.priority);
  const findings = ranked.slice(0, MAX_FINDINGS).map((r) => r.finding);

  if (!findings.length) {
    return [
      {
        id: "clear",
        tone: "clear",
        title: "All clear — nothing here needs your attention today.",
      },
    ];
  }
  return findings;
}
