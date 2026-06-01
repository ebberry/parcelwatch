import type { WatchItem } from "@/lib/watches";
import { matchTopics } from "@/lib/watches/topics";

/**
 * King County Council source — Legistar Web API (keyless, verified 2026-05-31).
 * Pulls recent legislation ("matters") and keeps those matching a tracked topic.
 */

const KC_MATTERS = "https://webapi.legistar.com/v1/kingcounty/matters";

export interface KcMatter {
  MatterId: number;
  MatterFile: string | null;
  MatterName: string | null;
  MatterTitle: string | null;
  MatterTypeName: string | null;
  MatterStatusName: string | null;
  MatterBodyName: string | null;
  MatterIntroDate: string | null;
}

/** Pure normalizer: map matters → WatchItems, keep only topic matches. */
export function normalizeCouncil(raw: KcMatter[]): WatchItem[] {
  const items: WatchItem[] = [];
  for (const m of raw) {
    // MatterName is sometimes empty — fall back to the full legal MatterTitle.
    const title = ((m.MatterName || m.MatterTitle) ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    const topics = matchTopics(`${m.MatterName ?? ""} ${m.MatterTitle ?? ""}`);
    if (!topics.length) continue;
    const detail = [m.MatterTypeName, m.MatterStatusName].filter(Boolean).join(" · ") || null;
    // The full legal title often carries the location/specifics the AI needs to
    // judge relevance (e.g. a street address in a mainland city).
    const fullText = (m.MatterTitle ?? "").replace(/\s+/g, " ").trim() || null;
    items.push({
      kind: "council",
      externalId: `kc-matter-${m.MatterId}`,
      title: m.MatterFile ? `${m.MatterFile}: ${title}` : title,
      detail,
      fullText: fullText && fullText !== title ? fullText : null,
      url: `https://kingcounty.legistar.com/LegislationDetail.aspx?ID=${m.MatterId}`,
      date: m.MatterIntroDate ?? null,
      topics,
    });
  }
  return items;
}

/** Fetch recent King County Council legislation matching tracked topics. */
export async function fetchCouncilItems(limit = 100): Promise<WatchItem[]> {
  const url = `${KC_MATTERS}?$top=${limit}&$orderby=MatterIntroDate%20desc`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Legistar returned HTTP ${res.status}`);
  const raw = (await res.json()) as KcMatter[];
  return normalizeCouncil(raw);
}
