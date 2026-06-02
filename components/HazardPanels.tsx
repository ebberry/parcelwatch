import { Waves, Activity } from "lucide-react";
import { Unavailable } from "@/components/Unavailable";
import { Panel, Field, StatusPill, QuietNote, PanelInsight } from "@/components/Panel";
import { GLOSSARY } from "@/lib/glossary";
import type { SourcedValue } from "@/lib/provenance";
import type { FloodHazard, SeismicActivity, Earthquake } from "@/lib/hazards/service";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function floodPill(f: FloodHazard | null) {
  if (!f || !f.mapped) return undefined;
  if (f.inSFHA) return <StatusPill tone="watch">High-risk zone</StatusPill>;
  return (
    <StatusPill tone="good">
      {f.floodZone ? `Zone ${f.floodZone} · minimal` : "Minimal"}
    </StatusPill>
  );
}

export function FloodPanel({ sourced }: { sourced: SourcedValue<FloodHazard> }) {
  const f = sourced.value;
  return (
    <Panel title="Flood risk" icon={Waves} pill={floodPill(f)} sourced={sourced}>
      {!f ? (
        <Unavailable source={sourced.source} />
      ) : !f.mapped ? (
        <p className="text-sm text-pw-sub">
          This location isn&apos;t covered by FEMA&apos;s mapped flood data.
        </p>
      ) : (
        <>
          {f.inSFHA ? (
            <p className="mb-2 text-sm text-pw-sub">
              In a Special Flood Hazard Area — flood insurance is typically
              required for federally backed mortgages.
            </p>
          ) : (
            <QuietNote>Minimal flood hazard at this location.</QuietNote>
          )}
          <dl className="mt-2 divide-y-[0.5px] divide-pw-divider">
            <Field
              label="Flood zone"
              value={f.zoneSubtype ? `${f.floodZone} — ${f.zoneSubtype}` : f.floodZone}
              tip={GLOSSARY.floodZone}
            />
            <Field
              label="Special flood hazard area"
              value={f.inSFHA == null ? null : f.inSFHA ? "Yes" : "No"}
              tip={GLOSSARY.sfha}
            />
            <Field
              label="Base flood elevation"
              value={f.baseFloodElevationFt}
              suffix="ft"
              tip={GLOSSARY.baseFloodElevation}
            />
            <Field label="FIRM ID" value={f.firmId} tip={GLOSSARY.firm} />
          </dl>
        </>
      )}
    </Panel>
  );
}

function QuakeRow({ q }: { q: Earthquake }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="text-pw-ink">
        <span className="font-medium tabular-nums">M{q.magnitude?.toFixed(1) ?? "—"}</span>{" "}
        <span className="text-pw-sub">{q.place ?? "Unknown location"}</span>
      </span>
      <span className="shrink-0 text-right text-pw-faint">
        <span className="tabular-nums">{shortDate(q.time)}</span>
        {q.distanceMi != null && (
          <span className="block text-xs tabular-nums">{q.distanceMi} mi away</span>
        )}
      </span>
    </li>
  );
}

export function SeismicPanel({ sourced }: { sourced: SourcedValue<SeismicActivity> }) {
  const s = sourced.value;
  return (
    <Panel title="Earthquakes nearby" icon={Activity} sourced={sourced}>
      {!s ? (
        <Unavailable source={sourced.source} />
      ) : s.count === 0 ? (
        <QuietNote>
          No earthquakes of magnitude {s.minMagnitude}+ within {s.radiusMi} miles in
          the past year.
        </QuietNote>
      ) : (
        <>
          <p className="text-sm text-pw-sub">
            <span className="font-medium tabular-nums text-pw-ink">{s.count}</span>{" "}
            earthquakes of magnitude {s.minMagnitude}+ within {s.radiusMi} miles in
            the past year.
          </p>
          {s.largest && (
            <p className="mt-1 text-sm text-pw-sub">
              Largest:{" "}
              <span className="font-medium tabular-nums text-pw-ink">
                M{s.largest.magnitude?.toFixed(1)}
              </span>
              {s.largest.place ? ` · ${s.largest.place}` : ""} · {shortDate(s.largest.time)}
            </p>
          )}
          <ul className="mt-2 divide-y-[0.5px] divide-pw-divider border-t-[0.5px] border-pw-divider">
            {s.recent.map((q, i) => (
              <QuakeRow key={q.url ?? i} q={q} />
            ))}
          </ul>
          <PanelInsight>
            {s.largest?.magnitude != null && s.largest.magnitude >= 4
              ? "A magnitude 4+ quake is noticeable but rarely damaging. The Puget Sound region is seismically active, so quake-resilient construction and securing heavy items are sensible precautions."
              : "Small quakes like these are routine background activity across the Puget Sound region and rarely cause damage — not a sign of unusual risk at this address."}
          </PanelInsight>
        </>
      )}
    </Panel>
  );
}
