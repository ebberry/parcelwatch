import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { aiSummaries } from "@/db/schema";
import type { WatchItem } from "@/lib/watches";
import { aiEnabled, aiModel, claudeMessage, extractJson, AiError } from "./claude";

/**
 * AI enrichment for King County Council items — judges relevance to a Vashon /
 * rural King County homeowner and explains, in plain language, why an item may
 * matter. Solves the keyword filter's false positives (e.g. the *City of*
 * Shoreline matching the "shoreline" topic) by actually reading the item.
 *
 * Grounding is enforced in the prompt: summarize ONLY from the provided text,
 * never invent specifics. Output is cached by content hash (worker writes,
 * request path reads) so steady-state cost is ~zero. Always labeled as an AI
 * summary, distinct from the authoritative Legistar source.
 */

export type Relevance = "high" | "medium" | "low" | "none";
export type Scope = "countywide" | "regional" | "site-specific";

export interface CouncilInsight {
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

/** The homeowner context the model judges relevance against (first market). */
const AREA_CONTEXT =
  "a residential property owner on Vashon Island, in unincorporated King County, Washington — an island community reached only by ferry, separate from the county's mainland cities (Seattle, Shoreline, Bellevue, Kent, etc.)";

const BATCH_SIZE = 10;

const SYSTEM_PROMPT = `You help a homeowner understand King County Council legislation. For each item you will judge how much it matters to the described homeowner and explain it plainly.

Strict rules:
- Use ONLY the text provided for each item. Never use outside knowledge and never invent specifics (names, places, dollar amounts, dates) not present in the text.
- If an item's text is too vague to tell, set relevance "low" and say it's unclear.
- "scope": countywide (applies across all of King County), regional (a sub-area or corridor), or site-specific (one address/parcel/project).
- A site-specific item about a place far from the homeowner's area does NOT affect them: set relevance "none". For example, an item about a specific property in a mainland city does not affect a Vashon Island homeowner.
- "relevance": high = likely direct effect on this homeowner's property, taxes, services, or rights; medium = plausible area-wide interest; low = minor or unclear; none = unrelated or a far-away site-specific matter.
- "summary": ONE sentence, plain language, on what the item does.
- "whyItMatters": ONE sentence on the concrete impact to THIS homeowner, or null when relevance is "none".
- Be concise and neutral — no legalese, no hype.

Respond with ONLY a JSON array, one object per item, in exactly this shape (no prose, no code fences):
[{"externalId":"<id>","relevance":"high|medium|low|none","scope":"countywide|regional|site-specific","summary":"...","whyItMatters":"..."|null}]`;

/** Build the user message listing the items. Pure (exported for tests). */
export function buildCouncilUserPrompt(items: WatchItem[]): string {
  const lines = items.map((it, i) => {
    const parts = [
      `${i + 1}. externalId: ${it.externalId}`,
      `   title: ${it.title}`,
    ];
    if (it.fullText) parts.push(`   full text: ${it.fullText}`);
    if (it.detail) parts.push(`   type/status: ${it.detail}`);
    return parts.join("\n");
  });
  return `The homeowner is ${AREA_CONTEXT}.\n\nItems:\n${lines.join("\n\n")}`;
}

/** Validate + coerce the model's array against the items we asked about. Pure. */
export function parseCouncilInsights(text: string, validIds: Set<string>): CouncilInsight[] {
  const raw = extractJson<unknown[]>(text);
  if (!Array.isArray(raw)) throw new AiError("Expected a JSON array of insights");
  const out: CouncilInsight[] = [];
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
  externalId: string;
  contentHash: string;
  insight: CouncilInsight;
}

async function readCache(ids: string[]): Promise<Map<string, CacheRow>> {
  const map = new Map<string, CacheRow>();
  if (!ids.length) return map;
  const rows = await getDb()
    .select()
    .from(aiSummaries)
    .where(inArray(aiSummaries.externalId, ids));
  for (const r of rows) {
    map.set(r.externalId, {
      externalId: r.externalId,
      contentHash: r.contentHash,
      insight: r.data as unknown as CouncilInsight,
    });
  }
  return map;
}

/**
 * REQUEST PATH (read-only): attach cached insights to items. Never calls the
 * API, so it adds no latency or cost to a page view.
 */
export async function attachCachedInsights(
  items: WatchItem[],
): Promise<Map<string, CouncilInsight>> {
  const cache = await readCache(items.map((i) => i.externalId));
  const out = new Map<string, CouncilInsight>();
  for (const item of items) {
    const hit = cache.get(item.externalId);
    if (hit && hit.contentHash === itemContentHash(item)) {
      out.set(item.externalId, hit.insight);
    }
  }
  return out;
}

/**
 * WORKER PATH: enrich items, calling Claude for cache misses (in batches) and
 * persisting results. Returns insights for every item we could enrich. Degrades
 * to an empty map when AI is disabled or the API errors — never throws.
 */
export async function enrichAndCacheCouncil(
  items: WatchItem[],
): Promise<Map<string, CouncilInsight>> {
  const out = new Map<string, CouncilInsight>();
  if (!items.length) return out;

  const cache = await readCache(items.map((i) => i.externalId));
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
    let insights: CouncilInsight[];
    try {
      const text = await claudeMessage({
        system: SYSTEM_PROMPT,
        user: buildCouncilUserPrompt(batch),
        maxTokens: 1500,
      });
      insights = parseCouncilInsights(text, validIds);
    } catch {
      continue; // degrade gracefully on this batch
    }
    const byId = new Map(insights.map((x) => [x.externalId, x]));
    for (const item of batch) {
      const insight = byId.get(item.externalId);
      if (!insight) continue;
      await getDb()
        .insert(aiSummaries)
        .values({
          externalId: item.externalId,
          kind: "council",
          contentHash: itemContentHash(item),
          data: insight as unknown as Record<string, unknown>,
          model,
        })
        .onConflictDoUpdate({
          target: aiSummaries.externalId,
          set: {
            contentHash: itemContentHash(item),
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
export function isRelevant(insight: CouncilInsight | undefined): boolean {
  return insight != null && (insight.relevance === "high" || insight.relevance === "medium");
}
