import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import { Field } from "@/components/ReportPanel";
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

function PanelShell({
  title,
  sourced,
  children,
}: {
  title: string;
  sourced: SourcedValue<unknown>;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-xl border border-gray-200 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <ProvenanceBadgeFor sourced={sourced} />
      </div>
      {children}
    </section>
  );
}

export function FloodPanel({ sourced }: { sourced: SourcedValue<FloodHazard> }) {
  const f = sourced.value;
  return (
    <PanelShell title="Flood risk" sourced={sourced}>
      {!f ? (
        <p className="text-sm italic text-gray-400">Not available</p>
      ) : !f.mapped ? (
        <p className="text-sm text-gray-500">
          This location isn&apos;t covered by FEMA&apos;s mapped flood data.
        </p>
      ) : (
        <>
          {f.inSFHA ? (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-confidence-stale">
              High-risk flood area — Special Flood Hazard Area. Flood insurance is
              typically required for federally backed mortgages.
            </p>
          ) : (
            <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-confidence-confirmed">
              Minimal flood hazard at this location.
            </p>
          )}
          <dl className="divide-y divide-gray-100">
            <Field label="Flood zone" value={f.floodZone} />
            <Field
              label="Special Flood Hazard Area"
              value={f.inSFHA == null ? null : f.inSFHA ? "Yes" : "No"}
            />
            <Field
              label="Base flood elevation"
              value={f.baseFloodElevationFt}
              suffix="ft"
            />
            <Field label="FIRM ID" value={f.firmId} />
          </dl>
        </>
      )}
    </PanelShell>
  );
}

function QuakeRow({ q }: { q: Earthquake }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="text-gray-900">
        <span className="font-medium tabular-nums">
          M{q.magnitude?.toFixed(1) ?? "—"}
        </span>{" "}
        <span className="text-gray-600">{q.place ?? "Unknown location"}</span>
      </span>
      <span className="shrink-0 text-right text-gray-500">
        {shortDate(q.time)}
        {q.distanceKm != null && (
          <span className="block text-xs text-gray-400">{q.distanceKm} km away</span>
        )}
      </span>
    </li>
  );
}

export function SeismicPanel({
  sourced,
}: {
  sourced: SourcedValue<SeismicActivity>;
}) {
  const s = sourced.value;
  return (
    <PanelShell title="Earthquakes nearby" sourced={sourced}>
      {!s ? (
        <p className="text-sm italic text-gray-400">Not available</p>
      ) : s.count === 0 ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-confidence-confirmed">
          No earthquakes of magnitude {s.minMagnitude}+ recorded within{" "}
          {s.radiusKm} km in the past year.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{s.count}</span> earthquake
            {s.count === 1 ? "" : "s"} of magnitude {s.minMagnitude}+ within{" "}
            {s.radiusKm} km in the past year.
          </p>
          {s.largest && (
            <p className="mt-1 text-sm text-gray-600">
              Largest: <span className="font-medium">M{s.largest.magnitude?.toFixed(1)}</span>
              {s.largest.place ? ` · ${s.largest.place}` : ""} ·{" "}
              {shortDate(s.largest.time)}
            </p>
          )}
          <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
            {s.recent.map((q, i) => (
              <QuakeRow key={q.url ?? i} q={q} />
            ))}
          </ul>
        </>
      )}
    </PanelShell>
  );
}
