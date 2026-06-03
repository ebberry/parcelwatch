import { FlaskConical } from "lucide-react";
import { Unavailable } from "@/components/Unavailable";
import { Panel, StatusPill, QuietNote, PanelInsight, type PillTone } from "@/components/Panel";
import { SoilTestEntry } from "@/components/SoilTestEntry";
import type { SourcedValue } from "@/lib/provenance";
import type { SmelterPlume } from "@/lib/risk/service";

const TONE: Record<SmelterPlume["severity"], PillTone> = {
  "above-action": "alert",
  "above-cleanup": "watch",
  "below-cleanup": "good",
  unmodeled: "neutral",
};

/**
 * Tacoma Smelter Plume soil-contamination band for this parcel. Material here —
 * all of Vashon-Maury sits in the plume. Modeled estimate (not a measured soil
 * test); we label that plainly and point to the free Dirt Alert program.
 */
export function SmelterPlumePanel({
  sourced,
  parcelId,
  signedIn = false,
  serverSoil = null,
}: {
  sourced: SourcedValue<SmelterPlume>;
  parcelId: string;
  signedIn?: boolean;
  serverSoil?: number | null;
}) {
  const v = sourced.value;
  const tone = v ? TONE[v.severity] : "neutral";
  return (
    <Panel
      title="Soil contamination (Tacoma Smelter Plume)"
      icon={FlaskConical}
      pill={v ? <StatusPill tone={tone}>{v.band} arsenic</StatusPill> : undefined}
      sourced={sourced}
    >
      {!v ? (
        <Unavailable source={sourced.source} />
      ) : (
        <>
          <p className="text-sm text-pw-sub">
            This parcel sits in the Tacoma Smelter Plume — soil across Vashon-Maury
            carries arsenic and lead from the former ASARCO smelter
            {v.milesFromSmelter != null ? ` (~${v.milesFromSmelter} mi away)` : ""}.
            Ecology&apos;s map estimates the surface-soil arsenic here as{" "}
            <span className="font-medium text-pw-text">{v.band}</span>.
          </p>

          <p className="mt-2 rounded-lg bg-pw-inset px-3 py-2 text-sm text-pw-sub">
            <span className="font-medium text-pw-ink">This is a map-based estimate,
            not a measurement.</span>{" "}
            It&apos;s modeled from distance and wind direction from the smelter —
            the actual arsenic in your soil can be higher or lower. The only way to
            know your property is a soil test (Ecology offers it free; see below).
          </p>

          {v.severity === "above-action" && (
            <p className="mt-2 text-sm text-pw-sub">
              That&apos;s at or above the 100 ppm residential-yard action level
              (the state cleanup level is 20 ppm).
            </p>
          )}
          {v.severity === "above-cleanup" && (
            <p className="mt-2 text-sm text-pw-sub">
              That&apos;s above the 20 ppm state cleanup level but below the 100 ppm
              residential-yard action level.
            </p>
          )}
          {v.severity === "below-cleanup" && (
            <QuietNote>
              Estimated below the 20 ppm state cleanup level for arsenic.
            </QuietNote>
          )}
          {v.severity === "unmodeled" && (
            <QuietNote>
              No modeled estimate for this location (limited data or a state
              facility).
            </QuietNote>
          )}

          <PanelInsight>
            Free soil testing — and yard cleanup for qualifying properties — is
            available through Ecology&apos;s Dirt Alert program. A simple precaution
            anywhere in the plume: wash produce, keep bare soil covered, and remove
            shoes indoors.
          </PanelInsight>

          <SoilTestEntry parcelId={parcelId} signedIn={signedIn} serverValue={serverSoil} />
        </>
      )}
    </Panel>
  );
}
