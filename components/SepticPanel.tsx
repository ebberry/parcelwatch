import { Waves } from "lucide-react";
import { Panel, StatusPill, Field, PanelInsight, QuietNote, type PillTone } from "@/components/Panel";
import type { SourcedValue } from "@/lib/provenance";
import type { SepticStatus } from "@/lib/adapters/kingcounty/septic";

const LABEL: Record<SepticStatus["treatment"], string> = {
  septic: "On-site septic",
  sewer: "Sewer connection",
  vacant: "Vacant (no system on record)",
  other: "Other / mixed",
  unknown: "Not on record",
};

const TONE: Record<SepticStatus["treatment"], PillTone> = {
  septic: "watch",
  sewer: "good",
  vacant: "neutral",
  other: "neutral",
  unknown: "neutral",
};

/**
 * Septic vs sewer for this parcel + whether on-site sewage records exist to
 * retrieve. High value on Vashon (mostly septic). Keyed by PIN, so it's the
 * parcel's own record — not a spatial guess.
 */
export function SepticPanel({ sourced }: { sourced: SourcedValue<SepticStatus> }) {
  const v = sourced.value;
  return (
    <Panel
      title="Wastewater (septic / sewer)"
      icon={Waves}
      pill={v ? <StatusPill tone={TONE[v.treatment]}>{LABEL[v.treatment]}</StatusPill> : undefined}
      sourced={sourced}
    >
      {!v ? (
        <p className="text-sm text-pw-faint">Not available</p>
      ) : (
        <>
          {v.treatment === "septic" && (
            <p className="text-sm text-pw-sub">
              This parcel is served by an on-site septic system (OSS), not a public
              sewer — the owner maintains it, and it should be inspected on King
              County&apos;s schedule.
            </p>
          )}
          {v.treatment === "sewer" && (
            <p className="text-sm text-pw-sub">
              This parcel is connected to a public sewer
              {v.sewerAgency ? <> (agency: {v.sewerAgency})</> : null}.
            </p>
          )}
          {(v.treatment === "vacant" || v.treatment === "other" || v.treatment === "unknown") && (
            <QuietNote>
              No clear septic-or-sewer designation on record for this parcel
              {v.raw ? ` (King County lists it as "${v.raw}")` : ""}. Verify with
              Public Health.
            </QuietNote>
          )}

          <dl className="mt-3 divide-y-[0.5px] divide-pw-divider border-t-[0.5px] border-pw-divider">
            <Field
              label="On-site sewage records on file"
              value={
                v.records
                  ? `Yes — ${v.records.onlineRME + v.records.sewage} septic` +
                    (v.records.groupB ? `, ${v.records.groupB} Group B water` : "")
                  : "None found"
              }
            />
          </dl>

          <a
            href={v.recordsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-pw-green hover:underline"
          >
            Look up septic &amp; Group B records (as-builts) →
          </a>

          <PanelInsight>
            On septic, the drainfield&apos;s condition and capacity shape what you
            can add or remodel — pull the as-built before planning work. King
            County requires periodic OSS inspections; an unrecorded or failing
            system is a real cost to budget for.
          </PanelInsight>
        </>
      )}
    </Panel>
  );
}
