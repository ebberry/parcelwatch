import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import { Field } from "@/components/ReportPanel";
import { GLOSSARY } from "@/lib/glossary";
import type { SourcedValue } from "@/lib/provenance";
import type { NearbySites, NeighborhoodStats } from "@/lib/environment/service";

function Shell({
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

/** Generic "nearby sites" panel (EPA, Ecology, DOH). Quiet state is reassuring. */
export function NearbySitesPanel({
  title,
  sourced,
  noneMessage,
}: {
  title: string;
  sourced: SourcedValue<NearbySites>;
  noneMessage: string;
}) {
  const s = sourced.value;
  return (
    <Shell title={title} sourced={sourced}>
      {!s ? (
        <p className="text-sm italic text-gray-400">Not available</p>
      ) : s.count === 0 ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-confidence-confirmed">
          {noneMessage}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{s.count}</span> within{" "}
            {s.radiusKm} km{s.count > s.nearest.length ? ` · nearest ${s.nearest.length}` : ""}:
          </p>
          <ul className="divide-y divide-gray-100">
            {s.nearest.map((site, i) => (
              <li key={`${site.name}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="text-gray-900">
                  {site.name ?? "Unnamed"}
                  {site.detail && <span className="block text-xs text-gray-500">{site.detail}</span>}
                </span>
                {site.distanceKm != null && (
                  <span className="shrink-0 text-gray-500">{site.distanceKm} km</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
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
    <Shell title="Neighborhood (Census tract)" sourced={sourced}>
      {!n ? (
        needsKey ? (
          <p className="text-sm text-gray-500">
            Neighborhood statistics need a free U.S. Census API key. Set{" "}
            <code className="rounded bg-gray-100 px-1">CENSUS_API_KEY</code> in your
            environment to enable this panel.
          </p>
        ) : (
          <p className="text-sm italic text-gray-400">Not available</p>
        )
      ) : (
        <dl className="divide-y divide-gray-100">
          <Field label="Tract" value={n.tractName} />
          <Field label="Population" value={n.population?.toLocaleString() ?? null} />
          <Field label="Median household income" value={usd(n.medianHouseholdIncome)} />
          <Field
            label="Median home value"
            value={usd(n.medianHomeValue)}
            tip={GLOSSARY.assessedValue}
          />
          <Field
            label="Owner-occupied"
            value={n.ownerOccupiedPct != null ? `${n.ownerOccupiedPct}%` : null}
          />
        </dl>
      )}
    </Shell>
  );
}
