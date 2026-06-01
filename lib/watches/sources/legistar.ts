import type { WatchItem } from "@/lib/watches";
import { matchTopics } from "@/lib/watches/topics";

/**
 * Generic Legistar Web API source — King County and many WA cities (Seattle,
 * Bellevue, Redmond, …) run on Legistar with the identical shape, so one
 * adapter parameterized by client slug covers them all (keyless, verified
 * 2026-06-01). See /docs/data-sources.md.
 *
 * Unlike the old keyword-gated council source, this returns ALL recent matters
 * — the AI relevance layer (lib/ai) decides what's worth surfacing, which is
 * what makes city items work (keyword topics like "vashon" never match a
 * Seattle ordinance).
 */

export interface LegistarMatter {
  MatterId: number;
  MatterFile: string | null;
  MatterName: string | null;
  MatterTitle: string | null;
  MatterTypeName: string | null;
  MatterStatusName: string | null;
  MatterBodyName: string | null;
  MatterIntroDate: string | null;
}

/** Map raw matters → WatchItems for a given Legistar client. Pure. */
export function normalizeLegistar(
  raw: LegistarMatter[],
  opts: { client: string; sourceLabel: string },
): WatchItem[] {
  const items: WatchItem[] = [];
  for (const m of raw) {
    const title = ((m.MatterName || m.MatterTitle) ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    const detail = [m.MatterTypeName, m.MatterStatusName].filter(Boolean).join(" · ") || null;
    const fullText = (m.MatterTitle ?? "").replace(/\s+/g, " ").trim() || null;
    items.push({
      kind: "council",
      externalId: `${opts.client}-matter-${m.MatterId}`,
      title: m.MatterFile ? `${m.MatterFile}: ${title}` : title,
      detail,
      fullText: fullText && fullText !== title ? fullText : null,
      source: opts.sourceLabel,
      url: `https://${opts.client}.legistar.com/LegislationDetail.aspx?ID=${m.MatterId}`,
      date: m.MatterIntroDate ?? null,
      // Topics drive the display pills + topic-scoped watches; they NO LONGER
      // gate the feed (AI relevance does), so city items without Vashon
      // keywords still flow through.
      topics: matchTopics(`${m.MatterName ?? ""} ${m.MatterTitle ?? ""}`),
    });
  }
  return items;
}

/** Fetch recent matters for a Legistar client (e.g. "kingcounty", "seattle"). */
export async function fetchLegistarMatters(
  client: string,
  sourceLabel: string,
  limit = 60,
): Promise<WatchItem[]> {
  const url = `https://webapi.legistar.com/v1/${client}/matters?$top=${limit}&$orderby=MatterIntroDate%20desc`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Legistar (${client}) returned HTTP ${res.status}`);
  const raw = (await res.json()) as LegistarMatter[];
  return normalizeLegistar(raw, { client, sourceLabel });
}
