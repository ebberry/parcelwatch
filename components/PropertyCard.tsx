import Link from "next/link";
import { ArrowRight, Scale, Landmark, TrendingUp, Building2, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppealRecommendation } from "@/lib/appeals";

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const WATCH_BADGE: Record<string, { label: string; icon: LucideIcon }> = {
  assessment: { label: "Assessment", icon: Landmark },
  sales: { label: "Nearby sales", icon: TrendingUp },
  council: { label: "Gov’t activity", icon: Building2 },
};

export interface DashboardProperty {
  parcelId: string;
  address: string | null;
  city: string | null;
  assessedTotal: number | null;
  activeKinds: string[];
  recommendation: AppealRecommendation | null;
}

/** One watched property on the owner dashboard: facts, appeal signal, watches. */
export function PropertyCard({ property }: { property: DashboardProperty }) {
  const rec = property.recommendation;
  const appeal = rec?.shouldAppeal && rec.recommendedValue != null;

  return (
    <article className="rounded-xl border-[0.5px] border-pw-border bg-pw-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-medium text-pw-ink">
            {property.address ?? `Parcel ${property.parcelId}`}
          </h3>
          <p className="mt-0.5 text-sm text-pw-sub">
            {[property.city, `PIN ${property.parcelId}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {rec && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              appeal
                ? rec.strength === "strong"
                  ? "bg-pw-green text-white"
                  : "bg-pw-amber/20 text-pw-ink"
                : "bg-pw-inset text-pw-sub"
            }`}
          >
            {appeal ? `Appeal: ${rec.reductionPct}% lower` : "Assessment looks fair"}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-pw-sub">Assessed value</p>
          <p className="text-2xl font-medium tabular-nums text-pw-ink">
            {usd(property.assessedTotal)}
          </p>
        </div>
        {appeal && (
          <p className="text-right text-xs text-pw-sub">
            Evidence supports
            <br />
            <span className="font-medium text-pw-ink">≈ {usd(rec!.recommendedValue)}</span>
          </p>
        )}
      </div>

      {property.activeKinds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {property.activeKinds.map((k) => {
            const b = WATCH_BADGE[k];
            if (!b) return null;
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full border-[0.5px] border-pw-border bg-pw-inset px-2 py-0.5 text-xs text-pw-sub"
              >
                <Check className="h-3 w-3 text-pw-green" strokeWidth={2.25} aria-hidden="true" />
                {b.label}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/parcel/${property.parcelId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-pw-green px-3.5 py-1.5 text-sm font-medium text-white hover:bg-pw-ink"
        >
          Open report
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Link
          href={`/parcel/${property.parcelId}/appeal`}
          className="inline-flex items-center gap-1.5 rounded-lg border-[0.5px] border-pw-green px-3.5 py-1.5 text-sm font-medium text-pw-green hover:bg-pw-accent/10"
        >
          <Scale className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Prepare appeal
        </Link>
      </div>
    </article>
  );
}
