import { Mountain } from "lucide-react";
import { Panel, StatusPill, QuietNote, Field, PanelInsight } from "@/components/Panel";
import type { SourcedValue } from "@/lib/provenance";
import type { GeoHazards } from "@/lib/risk/service";

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Site-specific mapped hazards: King County critical-area designations the
 * parcel falls in (regulatory) + WA DNR liquefaction susceptibility. Distinct
 * from the NRI panel's tract-level relative index — these are point-in-polygon
 * facts that can constrain development.
 */
export function GeoHazardsPanel({ sourced }: { sourced: SourcedValue<GeoHazards> }) {
  const v = sourced.value;
  const count = v?.criticalAreas.length ?? 0;
  return (
    <Panel
      title="Critical areas & geology"
      icon={Mountain}
      pill={count > 0 ? <StatusPill tone="watch">{count} mapped here</StatusPill> : undefined}
      sourced={sourced}
    >
      {!v ? (
        <p className="text-sm text-pw-faint">Not available</p>
      ) : (
        <>
          {v.criticalAreas.length > 0 ? (
            <>
              <p className="text-sm text-pw-sub">
                This parcel falls within mapped King County critical-area
                hazard{v.criticalAreas.length === 1 ? "" : "s"}:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {v.criticalAreas.map((h) => (
                  <StatusPill key={h} tone="watch">
                    {h}
                  </StatusPill>
                ))}
              </div>
            </>
          ) : (
            <QuietNote>
              Not within any mapped King County critical-area hazard.
            </QuietNote>
          )}

          {v.liquefaction && (
            <dl className="mt-3 divide-y-[0.5px] divide-pw-divider border-t-[0.5px] border-pw-divider">
              <Field
                label="Liquefaction susceptibility (WA DNR)"
                value={sentenceCase(v.liquefaction)}
              />
            </dl>
          )}

          <PanelInsight>
            Critical-area designations can add requirements to building here
            (setbacks, a geotechnical study, limits on clearing). They&apos;re a
            flag to verify with King County Permitting — not a bar on use.
          </PanelInsight>
        </>
      )}
    </Panel>
  );
}
