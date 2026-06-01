import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { watches, alerts } from "@/db/schema";
import { fetchCouncilItems } from "./sources/council";
import {
  attachCachedInsights,
  relevanceRank,
  type CouncilInsight,
} from "@/lib/ai/council";
import { unavailable, type SourcedValue } from "@/lib/provenance";
import type { WatchItem } from "./index";

const COUNCIL_LABEL = "King County Council (Legistar)";

/** A council item plus its cached AI insight (null when AI is off / not yet run). */
export interface CouncilFeedItem extends WatchItem {
  insight: CouncilInsight | null;
}

/**
 * Live "what's in motion" — current King County Council legislation. When AI
 * enrichment is available we attach the cached insight, drop items the model
 * judged irrelevant ("none"), and sort most-relevant first. With no AI (or
 * before the worker has enriched), it behaves exactly as before. The durable
 * alert feed (below) is what diffs over time.
 */
export async function getCouncilActivity(
  limit = 8,
): Promise<SourcedValue<CouncilFeedItem[]>> {
  try {
    const items = await fetchCouncilItems();
    const insights = await attachCachedInsights(items);
    let feed: CouncilFeedItem[] = items.map((it) => ({
      ...it,
      insight: insights.get(it.externalId) ?? null,
    }));
    if (insights.size > 0) {
      feed = feed
        .filter((f) => !f.insight || f.insight.relevance !== "none")
        .sort(
          (a, b) =>
            relevanceRank(a.insight?.relevance ?? "low") -
            relevanceRank(b.insight?.relevance ?? "low"),
        );
    }
    return {
      value: feed.slice(0, limit),
      source: COUNCIL_LABEL,
      fetchedAt: new Date().toISOString(),
      confidence: "live",
    };
  } catch {
    return unavailable(COUNCIL_LABEL);
  }
}

export interface AlertRow {
  id: number;
  kind: string;
  title: string;
  detail: string | null;
  url: string | null;
  source: string;
  topics: string[];
  observedAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
}

export async function getAlerts(userId: string, limit = 25): Promise<AlertRow[]> {
  const db = getDb();
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt))
    .limit(limit) as unknown as Promise<AlertRow[]>;
}

export async function getUnreadAlertCount(userId: string): Promise<number> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(eq(alerts.userId, userId), sql`${alerts.readAt} is null`));
  return count;
}

export async function markAllAlertsRead(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(alerts)
    .set({ readAt: new Date() })
    .where(and(eq(alerts.userId, userId), sql`${alerts.readAt} is null`));
}

/**
 * Which watch kinds are active for this user on this parcel — drives the
 * "Watch this property" toggles on the report. Council/legislature are
 * jurisdiction-wide (any parcel scope counts); parcel kinds must match the PIN.
 */
export async function getActiveWatchKinds(
  userId: string,
  parcelId: string,
): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ kind: watches.kind, parcelId: watches.parcelId })
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.active, true)));
  const active = new Set<string>();
  for (const r of rows) {
    if (r.kind === "council" || r.kind === "legislature") active.add(r.kind);
    else if (r.parcelId === parcelId) active.add(r.kind);
  }
  return active;
}

/**
 * Ensure a user has a default council watch (all topics), so polls generate
 * alerts for them. Idempotent.
 */
export async function ensureDefaultWatch(
  userId: string,
  parcelId: string | null,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.kind, "council")))
    .limit(1);
  if (existing.length) return;
  await db.insert(watches).values({
    userId,
    parcelId,
    kind: "council",
    topics: [],
    digestFrequency: "weekly",
  });
}
