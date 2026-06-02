import { Landmark, Sparkles, ExternalLink } from "lucide-react";
import { Unavailable } from "@/components/Unavailable";
import { Panel, QuietNote, StatusPill } from "@/components/Panel";
import { topicLabel } from "@/lib/watches";
import type { SourcedValue } from "@/lib/provenance";
import type { CivicFeedItem } from "@/lib/watches/service";
import type { Relevance } from "@/lib/ai/civic";

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

const RELEVANCE_PILL: Partial<Record<Relevance, { tone: "watch" | "neutral"; label: string }>> = {
  high: { tone: "watch", label: "Likely affects you" },
  medium: { tone: "neutral", label: "May affect you" },
};

/**
 * "In motion" — live King County Council legislation. When AI enrichment is on,
 * each item carries a plain-language summary + "why it matters", a relevance
 * pill, and an "AI summary" label (distinct from the authoritative Legistar
 * source). Without AI it falls back to the raw title + type/status.
 */
export function ActivityPanel({ sourced }: { sourced: SourcedValue<CivicFeedItem[]> }) {
  const items = sourced.value;
  return (
    <Panel title="In motion — your governments" icon={Landmark} sourced={sourced}>
      {!items ? (
        <Unavailable source={sourced.source} />
      ) : items.length === 0 ? (
        <QuietNote>
          No recent county, city, or state legislation that looks relevant to this
          property right now.
        </QuietNote>
      ) : (
        <ul className="divide-y-[0.5px] divide-pw-divider">
          {items.map((it) => {
            const pill = it.insight ? RELEVANCE_PILL[it.insight.relevance] : undefined;
            // With an AI summary, lead with the plain-language headline and link
            // to the source compactly (file ref); the long legal title is the
            // fallback only when there's no summary.
            const fileMatch = it.title.match(/^([A-Za-z]+[\s-]?[\d-]+):/);
            const fileRef = fileMatch ? fileMatch[1] : "View source";
            return (
              <li key={it.externalId} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  {it.insight ? (
                    <p className="font-medium text-pw-ink">{it.insight.summary}</p>
                  ) : (
                    <a
                      href={it.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-pw-ink hover:text-pw-green hover:underline"
                    >
                      {it.title}
                    </a>
                  )}
                  {it.date && (
                    <span className="shrink-0 text-xs tabular-nums text-pw-faint">
                      {shortDate(it.date)}
                    </span>
                  )}
                </div>

                {it.insight ? (
                  it.insight.whyItMatters && (
                    <p className="mt-1 text-sm text-pw-sub">
                      <span className="font-medium text-pw-ink">Why it matters: </span>
                      {it.insight.whyItMatters}
                    </p>
                  )
                ) : (
                  <>
                    <p className="mt-0.5 text-xs text-pw-faint">{it.source}</p>
                    {it.detail && <p className="mt-0.5 text-sm text-pw-sub">{it.detail}</p>}
                  </>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {pill && <StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
                  {it.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border-[0.5px] border-pw-border bg-pw-inset px-2 py-0.5 text-xs text-pw-sub"
                    >
                      {topicLabel(t)}
                    </span>
                  ))}
                  {it.insight && (
                    <a
                      href={it.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-pw-green hover:underline"
                    >
                      {fileRef} <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  )}
                  {it.insight && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-pw-faint">
                      <Sparkles className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                      AI · {it.source.replace(/ \(Legistar\)$/, "")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
