import type { ReactNode } from "react";
import { Unavailable } from "@/components/Unavailable";
import type { LucideIcon } from "lucide-react";
import { Users } from "lucide-react";
import { Panel, Field, QuietNote, MetricTile, PanelInsight } from "@/components/Panel";
import { GLOSSARY } from "@/lib/glossary";
import { titleCaseName } from "@/lib/format";
import type { SourcedValue } from "@/lib/provenance";
import type { NearbySites, NeighborhoodStats } from "@/lib/environment/service";

/** Generic "nearby sites" panel (EPA, DOH). Quiet state is reassuring. */
export function NearbySitesPanel({
  title,
  icon,
  sourced,
  noneMessage,
  insight,
}: {
  title: string;
  icon?: LucideIcon;
  sourced: SourcedValue<NearbySites>;
  noneMessage: string;
  /** Plain-language interpretation shown when there are nearby sites. */
  insight?: ReactNode;
}) {
  const s = sourced.value;
  return (
    <Panel title={title} icon={icon} sourced={sourced}>
      {!s ? (
        <Unavailable source={sourced.source} />
      ) : s.count === 0 ? (
        <QuietNote>{noneMessage}</QuietNote>
      ) : (
        <>
          <p className="mb-1 text-sm text-pw-sub">
            <span className="font-medium tabular-nums text-pw-ink">{s.count}</span>{" "}
            within {s.radiusMi} mi
            {s.count > s.nearest.length ? ` · nearest ${s.nearest.length}` : ""}
          </p>
          <ul className="divide-y-[0.5px] divide-pw-divider">
            {s.nearest.map((site, i) => (
              <li
                key={`${site.name}-${i}`}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span className="text-pw-ink">
                  {titleCaseName(site.name) ?? "Unnamed"}
                  {site.detail && (
                    <span className="block text-xs text-pw-faint">{site.detail}</span>
                  )}
                </span>
                {site.distanceMi != null && (
                  <span className="shrink-0 tabular-nums text-pw-sub">
                    {site.distanceMi} mi
                  </span>
                )}
              </li>
            ))}
          </ul>
          {insight && <PanelInsight>{insight}</PanelInsight>}
        </>
      )}
    </Panel>
  );
}

const usd = (n: number | null) => (n == null ? null : `$${Math.round(n).toLocaleString("en-US")}`);

export function NeighborhoodPanel({
  sourced,
  needsKey,
}: {
  sourced: SourcedValue<NeighborhoodStats>;
  needsKey: boolean;
}) {
  const n = sourced.value;
  return (
    <Panel title="Neighborhood" icon={Users} sourced={sourced}>
      {!n ? (
        needsKey ? (
          <p className="text-sm text-pw-sub">
            Neighborhood statistics need a free U.S. Census API key. Set{" "}
            <code className="rounded bg-pw-inset px-1 text-pw-ink">CENSUS_API_KEY</code>{" "}
            to enable this panel.
          </p>
        ) : (
          <Unavailable source={sourced.source} />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              label="Median home value"
              value={usd(n.medianHomeValue) ?? "—"}
            />
            <MetricTile
              label="Median income"
              value={usd(n.medianHouseholdIncome) ?? "—"}
            />
          </div>
          <dl className="mt-3 divide-y-[0.5px] divide-pw-divider">
            <Field label="Census tract" value={n.tractName} />
            <Field label="Population" value={n.population?.toLocaleString() ?? null} />
            <Field
              label="Owner-occupied"
              value={n.ownerOccupiedPct != null ? `${n.ownerOccupiedPct}%` : null}
            />
          </dl>
          <PanelInsight>
            A snapshot of the surrounding census tract for context — it describes the
            wider area, not your specific property.
          </PanelInsight>
        </>
      )}
    </Panel>
  );
}
