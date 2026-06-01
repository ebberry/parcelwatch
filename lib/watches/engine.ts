import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { watches, watchSeen, alerts } from "@/db/schema";
import { fetchCouncilItems } from "./sources/council";
import type { WatchItem, WatchKind } from "./index";

export const SOURCE_LABEL: Record<WatchKind, string> = {
  council: "King County Council (Legistar)",
  legislature: "WA Legislature",
};

async function fetchItems(kind: WatchKind): Promise<WatchItem[]> {
  switch (kind) {
    case "council":
      return fetchCouncilItems();
    default:
      return [];
  }
}

export interface PollResult {
  kind: WatchKind;
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
export async function runWatchPoll(kind: WatchKind): Promise<PollResult> {
  const db = getDb();
  const items = await fetchItems(kind);

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

    for (const sub of subs) {
      const subTopics = sub.topics ?? [];
      const relevant = subTopics.length === 0 || item.topics.some((t) => subTopics.includes(t));
      if (!relevant) continue;
      await db.insert(alerts).values({
        userId: sub.userId,
        parcelId: sub.parcelId,
        kind,
        title: item.title,
        detail: item.detail,
        url: item.url,
        source: SOURCE_LABEL[kind],
        topics: item.topics,
        observedAt: item.date ? new Date(item.date) : null,
      });
      alertsCreated++;
    }
  }
  return { kind, fetched: items.length, seededBaseline: false, newItems, alertsCreated };
}

/** Run all watch kinds. */
export async function runAllWatches(): Promise<PollResult[]> {
  const kinds: WatchKind[] = ["council"];
  const results: PollResult[] = [];
  for (const kind of kinds) results.push(await runWatchPoll(kind));
  return results;
}
