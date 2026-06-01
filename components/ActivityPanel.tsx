import { Landmark } from "lucide-react";
import { Panel, QuietNote } from "@/components/Panel";
import { topicLabel } from "@/lib/watches";
import type { SourcedValue } from "@/lib/provenance";
import type { WatchItem } from "@/lib/watches";

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * "In motion" — live King County Council legislation matching the topics that
 * affect a rural/Vashon property owner. Standing alerts accumulate via the
 * watch engine.
 */
export function ActivityPanel({ sourced }: { sourced: SourcedValue<WatchItem[]> }) {
  const items = sourced.value;
  return (
    <Panel title="In motion — King County Council" icon={Landmark} sourced={sourced}>
      {!items ? (
        <p className="text-sm text-pw-faint">Not available</p>
      ) : items.length === 0 ? (
        <QuietNote>
          No recent county legislation touching rural, Vashon, septic, shoreline,
          ADU, or property-tax topics.
        </QuietNote>
      ) : (
        <ul className="divide-y-[0.5px] divide-pw-divider">
          {items.map((it) => (
            <li key={it.externalId} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <a
                  href={it.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-pw-ink hover:text-pw-green hover:underline"
                >
                  {it.title}
                </a>
                {it.date && (
                  <span className="shrink-0 text-xs tabular-nums text-pw-faint">
                    {shortDate(it.date)}
                  </span>
                )}
              </div>
              {it.detail && <p className="mt-0.5 text-sm text-pw-sub">{it.detail}</p>}
              {it.topics.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {it.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border-[0.5px] border-pw-border bg-pw-inset px-2 py-0.5 text-xs text-pw-sub"
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
    </Panel>
  );
}
