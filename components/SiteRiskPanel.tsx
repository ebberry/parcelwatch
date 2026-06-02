import { ShieldAlert } from "lucide-react";
import { Unavailable } from "@/components/Unavailable";
import { Term } from "@/components/Term";
import { Panel, StatusPill, QuietNote, PanelInsight, type PillTone } from "@/components/Panel";
import { GLOSSARY } from "@/lib/glossary";
import type { SourcedValue } from "@/lib/provenance";
import type { SiteRisk } from "@/lib/risk/service";

/** NRI rating → calm-civic pill tone. */
function ratingTone(rating: string | null): PillTone {
  switch (rating) {
    case "Very High":
    case "Relatively High":
      return "watch";
    case "Relatively Moderate":
      return "neutral";
    default:
      return "good";
  }
}

/**
 * Natural-hazard risk for the parcel's census tract, from FEMA's National Risk
 * Index — a composite rating plus the hazards that actually contribute here.
 * Honest framing: a relative national index, not a site-specific assessment.
 */
export function SiteRiskPanel({ sourced }: { sourced: SourcedValue<SiteRisk> }) {
  const r = sourced.value;
  return (
    <Panel
      title="Natural hazard risk"
      icon={ShieldAlert}
      pill={
        r?.compositeRating ? (
          <StatusPill tone={ratingTone(r.compositeRating)}>{r.compositeRating}</StatusPill>
        ) : undefined
      }
      sourced={sourced}
    >
      {!r ? (
        <Unavailable source={sourced.source} />
      ) : (
        <>
          <p className="text-sm text-pw-sub">
            This area&apos;s overall{" "}
            <Term define={GLOSSARY.nriComposite}>natural-hazard risk</Term> is{" "}
            <span className="font-medium text-pw-ink">
              {(r.compositeRating ?? "unrated").toLowerCase()}
            </span>
            {r.statePercentile != null && (
              <> — about the {Math.round(r.statePercentile)}th percentile in Washington</>
            )}
            .
          </p>

          {r.topHazards.length > 0 ? (
            <>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-pw-faint">
                Top contributing hazards
              </p>
              <ul className="mt-1 divide-y-[0.5px] divide-pw-divider">
                {r.topHazards.map((h) => (
                  <li
                    key={h.code}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="text-pw-ink">{h.name}</span>
                    <StatusPill tone={ratingTone(h.rating)}>{h.rating}</StatusPill>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <QuietNote>
              No single hazard rises above relatively low for this area.
            </QuietNote>
          )}

          <PanelInsight>
            A relative, modeled national index for your census tract — useful for
            comparison and awareness, not a site-specific engineering assessment.
            For a decision (building, insurance), verify with the relevant study
            (flood, geotechnical, etc.).
          </PanelInsight>
        </>
      )}
    </Panel>
  );
}
