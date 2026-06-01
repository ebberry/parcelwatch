import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { aiSummaries } from "@/db/schema";
import type { WatchItem } from "@/lib/watches";
import type { AreaContext } from "@/lib/watches/area";
import { aiEnabled, aiModel, claudeMessage, extractJson, AiError } from "./claude";

/**
 * AI enrichment for civic legislation (county / city council + state bills) —
 * judges relevance to the parcel's AREA and explains, in plain language, why an
 * item may matter. This is what makes both "too far away" filtering and city
 * enrichment correct: relevance is judged against THIS parcel's jurisdiction,
 * and insights are cached per (item, area) so a Seattle ordinance can be
 * relevant to a Seattle parcel and "none" to a Vashon one.
 *
 * Grounding is enforced in the prompt: summarize ONLY from the provided text,
 * never invent specifics. Output is cached (worker writes, request path reads)
 * and always labeled as an AI summary, distinct from the authoritative source.
 */

export type Relevance = "high" | "medium" | "low" | "none";
export type Scope = "countywide" | "regional" | "site-specific";

export interface CivicInsight {
  externalId: string;
  relevance: Relevance;
  scope: Scope;
  /** One plain-language sentence: what the item does. */
  summary: string;
  /** One sentence on the homeowner impact, or null when not relevant. */
  whyItMatters: string | null;
}

const RELEVANCE: Relevance[] = ["high", "medium", "low", "none"];
const SCOPES: Scope[] = ["countywide", "regional", "site-specific"];
const BATCH_SIZE = 10;

const SYSTEM_PROMPT = `You help a homeowner understand pending legislation from their local governments (county, city, and state). For each item you will judge how much it matters to the described homeowner and explain it plainly.

Strict rules:
- Use ONLY the text provided for each item. Never use outside knowledge and never invent specifics (names, places, dollar amounts, dates) not present in the text.
- If an item's text is too vague to tell, set relevance "low" and say it's unclear.
- "scope": countywide (applies across the whole jurisdiction), regional (a sub-area or corridor), or site-specific (one address/parcel/project).
- A site-specific item about a place OUTSIDE or far from the homeowner's area does NOT affect them: set relevance "none". For example, an item about a specific property in a different city does not affect this homeowner.
- "relevance": high = likely direct effect on this homeowner's property, taxes, services, or rights; medium = plausible area-wide interest; low = minor or unclear; none = unrelated or a far-away/other-jurisdiction site-specific matter.
- "summary": ONE sentence, plain language, on what the item does.
- "whyItMatters": ONE sentence on the concrete impact to THIS homeowner, or null when relevance is "none".
- Be concise and neutral — no legalese, no hype.

Respond with ONLY a JSON array, one object per item, in exactly this shape (no prose, no code fences):
[{"externalId":"<id>","relevance":"high|medium|low|none","scope":"countywide|regional|site-specific","summary":"...","whyItMatters":"..."|null}]`;

/** Build the user message listing the items, for a given area. Pure. */
export function buildCivicUserPrompt(items: WatchItem[], area: AreaContext): string {
  const lines = items.map((it, i) => {
    const parts = [
      `${i + 1}. externalId: ${it.externalId}`,
      `   source: ${it.source}`,
      `   title: ${it.title}`,
    ];
    if (it.fullText) parts.push(`   full text: ${it.fullText}`);
    if (it.detail) parts.push(`   type/status: ${it.detail}`);
    return parts.join("\n");
  });
  return `The homeowner is ${area.description}.\n\nItems:\n${lines.join("\n\n")}`;
}

/** Validate + coerce the model's array against the items we asked about. Pure. */
export function parseCivicInsights(text: string, validIds: Set<string>): CivicInsight[] {
  const raw = extractJson<unknown[]>(text);
  if (!Array.isArray(raw)) throw new AiError("Expected a JSON array of insights");
  const out: CivicInsight[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.externalId === "string" ? o.externalId : null;
    if (!id || !validIds.has(id)) continue;
    const relevance = (RELEVANCE as string[]).includes(o.relevance as string)
      ? (o.relevance as Relevance)
      : "low";
    const scope = (SCOPES as string[]).includes(o.scope as string)
      ? (o.scope as Scope)
      : "countywide";
    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    if (!summary) continue;
    const whyItMatters =
      typeof o.whyItMatters === "string" && o.whyItMatters.trim() && relevance !== "none"
        ? o.whyItMatters.trim()
        : null;
    out.push({ externalId: id, relevance, scope, summary, whyItMatters });
  }
  return out;
}

/** Stable, dependency-free content hash (djb2) of an item's summarizable text. */
export function itemContentHash(item: WatchItem): string {
  const s = `${item.title}|${item.fullText ?? ""}|${item.detail ?? ""}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

interface CacheRow {
  contentHash: string;
  insight: CivicInsight;
}

async function readCache(ids: string[], areaKey: string): Promise<Map<string, CacheRow>> {
  const map = new Map<string, CacheRow>();
  if (!ids.length) return map;
  const rows = await getDb()
    .select()
    .from(aiSummaries)
    .where(and(eq(aiSummaries.areaKey, areaKey), inArray(aiSummaries.externalId, ids)));
  for (const r of rows) {
    map.set(r.externalId, {
      contentHash: r.contentHash,
      insight: r.data as unknown as CivicInsight,
    });
  }
  return map;
}

/**
 * REQUEST PATH (read-only): attach cached insights for this area to items.
 * Never calls the API — no latency or cost on a page view.
 */
export async function attachCachedInsights(
  items: WatchItem[],
  areaKey: string,
): Promise<Map<string, CivicInsight>> {
  const cache = await readCache(items.map((i) => i.externalId), areaKey);
  const out = new Map<string, CivicInsight>();
  for (const item of items) {
    const hit = cache.get(item.externalId);
    if (hit && hit.contentHash === itemContentHash(item)) {
      out.set(item.externalId, hit.insight);
    }
  }
  return out;
}

/**
 * WORKER PATH: enrich items for an area, calling Claude for cache misses (in
 * batches) and persisting per (item, area). Degrades to whatever is cached when
 * AI is disabled or the API errors — never throws.
 */
export async function enrichAndCacheCivic(
  items: WatchItem[],
  area: AreaContext,
): Promise<Map<string, CivicInsight>> {
  const out = new Map<string, CivicInsight>();
  if (!items.length) return out;

  const cache = await readCache(items.map((i) => i.externalId), area.key);
  const stale: WatchItem[] = [];
  for (const item of items) {
    const hit = cache.get(item.externalId);
    if (hit && hit.contentHash === itemContentHash(item)) {
      out.set(item.externalId, hit.insight);
    } else {
      stale.push(item);
    }
  }

  if (!stale.length || !aiEnabled()) return out;

  const model = aiModel();
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = stale.slice(i, i + BATCH_SIZE);
    const validIds = new Set(batch.map((b) => b.externalId));
    let insights: CivicInsight[];
    try {
      const text = await claudeMessage({
        system: SYSTEM_PROMPT,
        user: buildCivicUserPrompt(batch, area),
        maxTokens: 1500,
      });
      insights = parseCivicInsights(text, validIds);
    } catch {
      continue; // degrade gracefully on this batch
    }
    const byId = new Map(insights.map((x) => [x.externalId, x]));
    for (const item of batch) {
      const insight = byId.get(item.externalId);
      if (!insight) continue;
      const hash = itemContentHash(item);
      await getDb()
        .insert(aiSummaries)
        .values({
          externalId: item.externalId,
          areaKey: area.key,
          kind: item.kind,
          contentHash: hash,
          data: insight as unknown as Record<string, unknown>,
          model,
        })
        .onConflictDoUpdate({
          target: [aiSummaries.externalId, aiSummaries.areaKey],
          set: {
            contentHash: hash,
            data: insight as unknown as Record<string, unknown>,
            model,
            createdAt: new Date(),
          },
        });
      out.set(item.externalId, insight);
    }
  }
  return out;
}

/** Rank for sorting/filtering (lower = more relevant). */
export function relevanceRank(r: Relevance): number {
  return RELEVANCE.indexOf(r);
}

/** Whether an item is worth surfacing/alerting (high or medium). */
export function isRelevant(insight: CivicInsight | undefined): boolean {
  return insight != null && (insight.relevance === "high" || insight.relevance === "medium");
}
