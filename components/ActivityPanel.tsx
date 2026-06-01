import { ProvenanceBadgeFor } from "@/components/ProvenanceBadge";
import { topicLabel } from "@/lib/watches";
import type { SourcedValue } from "@/lib/provenance";
import type { WatchItem } from "@/lib/watches";

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * "In motion" — live King County Council legislation matching the topics that
 * affect a rural/Vashon property owner. The always-on view; standing alerts
 * accumulate over time via the watch engine.
 */
export function ActivityPanel({ sourced }: { sourced: SourcedValue<WatchItem[]> }) {
  const items = sourced.value;
  return (
    <section
      aria-label="In motion — King County Council"
      className="rounded-xl border border-gray-200 p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">In motion — King County Council</h2>
        <ProvenanceBadgeFor sourced={sourced} />
      </div>

      {!items ? (
        <p className="text-sm italic text-gray-400">Not available</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-confidence-confirmed">
          No recent county legislation touching rural, Vashon, septic, shoreline,
          ADU, or property-tax topics.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((it) => (
            <li key={it.externalId} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <a
                  href={it.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gray-900 hover:underline"
                >
                  {it.title}
                </a>
                {it.date && (
                  <span className="shrink-0 text-xs text-gray-500">{shortDate(it.date)}</span>
                )}
              </div>
              {it.detail && <p className="mt-0.5 text-sm text-gray-500">{it.detail}</p>}
              {it.topics.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {it.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {topicLabel(t)}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
