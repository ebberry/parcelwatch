import Link from "next/link";
import { Scale as ScaleIcon, ArrowRight } from "lucide-react";
import type { AppealRecommendation } from "@/lib/appeals";

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const STRENGTH: Record<AppealRecommendation["strength"], string> = {
  strong: "Strong case",
  moderate: "Moderate case",
  weak: "Worth a look",
  none: "Free to file",
};

/**
 * Report-level appeal callout — sits directly under the assessed value so the
 * report itself says "here's your value, and here's what you can do about it."
 * Uses the live recommendation: when the evidence supports a reduction it names
 * the figure; otherwise it still invites a (free) filing on other grounds.
 */
export function AppealCallout({
  pin,
  rec,
}: {
  pin: string;
  rec: AppealRecommendation;
}) {
  const appeal = rec.shouldAppeal && rec.recommendedValue != null;

  return (
    <section
      aria-label="Appeal your assessment"
      className={`rounded-xl border-[0.5px] p-5 ${
        appeal ? "border-pw-accent/50 bg-pw-accent/10" : "border-pw-border bg-pw-inset"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-pw-green/10 p-1.5">
          <ScaleIcon className="h-[18px] w-[18px] text-pw-green" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-medium text-pw-ink">
              {appeal
                ? "You may be able to lower this assessment"
                : "Appealing is free — even a long shot costs nothing"}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                rec.strength === "strong"
                  ? "bg-pw-green text-white"
                  : rec.strength === "moderate"
                    ? "bg-pw-amber/20 text-pw-ink"
                    : "bg-white/60 text-pw-sub"
              }`}
            >
              {STRENGTH[rec.strength]}
            </span>
          </div>

          {appeal ? (
            <p className="mt-1.5 text-sm text-pw-sub">
              Comparable evidence supports requesting about{" "}
              <span className="font-medium text-pw-ink">{usd(rec.recommendedValue)}</span> —
              roughly{" "}
              <span className="font-medium text-pw-amber">
                {usd(rec.reductionAmount)} ({rec.reductionPct}%)
              </span>{" "}
              below the {usd(rec.currentAssessed)} assessed value. A lower assessment means a
              lower tax bill.
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-pw-sub">
              On the sales and ratio data, this assessment looks fair and uniform with nearby
              homes. You can still appeal at no cost if you have grounds we can&apos;t see —
              damage, county-record errors, or site problems.
            </p>
          )}

          <Link
            href={`/parcel/${pin}/appeal`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-pw-green px-4 py-2 text-sm font-medium text-white hover:bg-pw-ink"
          >
            {appeal ? "Prepare your appeal" : "Review appeal options"}
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <p className="mt-2 text-xs text-pw-faint">
            Free to file · deadline July 1 (or 60 days after your value notice).
          </p>
        </div>
      </div>
    </section>
  );
}
