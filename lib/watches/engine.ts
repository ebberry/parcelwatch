import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { watches, watchSeen, alerts } from "@/db/schema";
import { fetchCouncilItems } from "./sources/council";
import { fetchNewBills, normalizeLegislature, sinceDate } from "./sources/legislature";
import { JURISDICTION_KINDS, type WatchItem, type JurisdictionWatchKind } from "./index";
import { runParcelWatches, type ParcelPollResult } from "./parcel";
import { enrichAndCacheCouncil, isRelevant, type CouncilInsight } from "@/lib/ai/council";

export const SOURCE_LABEL: Record<JurisdictionWatchKind, string> = {
  council: "King County Council (Legistar)",
  legislature: "WA Legislature web services",
};

async function fetchItems(kind: JurisdictionWatchKind): Promise<WatchItem[]> {
  switch (kind) {
    case "council":
      return fetchCouncilItems();
    case "legislature": {
      const bills = await fetchNewBills(sinceDate());
      return normalizeLegislature(bills);
    }
  }
}

export interface PollResult {
  kind: JurisdictionWatchKind;
  fetched: number;
  seededBaseline: boolean;
  newItems: number;
  alertsCreated: number;
}

/**
 * Poll a source, diff against last-seen ids, and create alerts for matching
 * subscriptions. The FIRST poll for a kind seeds the baseline silently (records
 * everything as seen, no alerts) so we only ever alert on genuinely new items.
 */
export async function runWatchPoll(kind: JurisdictionWatchKind): Promise<PollResult> {
  const db = getDb();
  const items = await fetchItems(kind);

  // AI enrichment for council items (relevance + plain-language "why it matters").
  // Populates the cache the live feed reads; no-op when AI is disabled.
  const insights: Map<string, CouncilInsight> =
    kind === "council" ? await enrichAndCacheCouncil(items) : new Map();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(watchSeen)
    .where(eq(watchSeen.kind, kind));

  // First run: establish the baseline without alerting.
  if (count === 0) {
    if (items.length) {
      await db
        .insert(watchSeen)
        .values(items.map((i) => ({ kind, externalId: i.externalId })))
        .onConflictDoNothing();
    }
    return { kind, fetched: items.length, seededBaseline: true, newItems: 0, alertsCreated: 0 };
  }

  const subs = await db
    .select()
    .from(watches)
    .where(and(eq(watches.kind, kind), eq(watches.active, true)));

  let newItems = 0;
  let alertsCreated = 0;
  for (const item of items) {
    const inserted = await db
      .insert(watchSeen)
      .values({ kind, externalId: item.externalId })
      .onConflictDoNothing()
      .returning({ externalId: watchSeen.externalId });
    if (!inserted.length) continue; // already seen
    newItems++;

    // When AI judged a council item, suppress alerts it deemed not worth one
    // (irrelevant / far-away). With no insight we keep the topic-based behavior.
    const insight = insights.get(item.externalId);
    if (insight && !isRelevant(insight)) continue;
    const detail = insight?.whyItMatters ?? item.detail;

    for (const sub of subs) {
      const subTopics = sub.topics ?? [];
      const relevant = subTopics.length === 0 || item.topics.some((t) => subTopics.includes(t));
      if (!relevant) continue;
      await db.insert(alerts).values({
        userId: sub.userId,
        parcelId: sub.parcelId,
        kind,
        title: item.title,
        detail,
        url: item.url,
        source: insight ? `${SOURCE_LABEL[kind]} · AI summary` : SOURCE_LABEL[kind],
        topics: item.topics,
        observedAt: item.date ? new Date(item.date) : null,
      });
      alertsCreated++;
    }
  }
  return { kind, fetched: items.length, seededBaseline: false, newItems, alertsCreated };
}

export interface AllWatchResults {
  jurisdiction: PollResult[];
  parcel: ParcelPollResult;
}

/** Run every watch — jurisdiction feeds then parcel state-diffs. */
export async function runAllWatches(): Promise<AllWatchResults> {
  const jurisdiction: PollResult[] = [];
  for (const kind of JURISDICTION_KINDS) {
    jurisdiction.push(await runWatchPoll(kind));
  }
  const parcel = await runParcelWatches();
  return { jurisdiction, parcel };
}
