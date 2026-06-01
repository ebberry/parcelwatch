import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { watches, alerts } from "@/db/schema";
import { fetchLegistarMatters } from "./sources/legistar";
import { fetchNewBills, normalizeLegislature, sinceDate } from "./sources/legislature";
import {
  attachCachedInsights,
  relevanceRank,
  type CivicInsight,
} from "@/lib/ai/civic";
import { resolveArea, type AreaContext } from "./area";
import { getParcelCore } from "@/lib/parcels/service";
import { unavailable, type SourcedValue } from "@/lib/provenance";
import type { WatchItem } from "./index";

/** The launch market — always warmed so any Vashon report's feed is enriched. */
const MARKET_AREA = resolveArea({ city: "VASHON" });

/**
 * The distinct civic areas to keep warm — derived from users' SAVED ADDRESSES
 * (the parcels they've watched), plus the market default. The worker enriches
 * each so every user's report feed is AI-ready in their own jurisdiction.
 */
export async function getActiveAreas(): Promise<AreaContext[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ parcelId: watches.parcelId })
    .from(watches)
    .where(and(eq(watches.active, true), isNotNull(watches.parcelId)));

  const byKey = new Map<string, AreaContext>([[MARKET_AREA.key, MARKET_AREA]]);
  for (const r of rows) {
    if (!r.parcelId) continue;
    const core = (await getParcelCore(r.parcelId)).value;
    const area = resolveArea({ city: core?.city ?? null });
    byKey.set(area.key, area);
  }
  return [...byKey.values()];
}

/** A civic item plus its cached AI insight (null when AI is off / not yet run). */
export interface CivicFeedItem extends WatchItem {
  insight: CivicInsight | null;
}

/**
 * Live "what's in motion" across the parcel's governments — its county and city
 * councils (Legistar) plus WA state bills — judged for THIS area. When AI
 * enrichment is cached we drop items the model judged irrelevant ("none") and
 * sort most-relevant first. Without AI we fall back to the keyword-topic subset
 * (so a cold/no-key feed isn't a dump of 60 raw items).
 */
/**
 * Fetch all legislation that applies to an area — its councils (county + city)
 * plus WA state bills — un-enriched. Shared by the display and the worker warmer.
 */
export async function fetchAreaItems(area: AreaContext): Promise<WatchItem[]> {
  const councilFetches = area.councils.map((c) =>
    fetchLegistarMatters(c.client, `${c.label} (Legistar)`, 60).catch(() => [] as WatchItem[]),
  );
  const legFetch = fetchNewBills(sinceDate())
    .then(normalizeLegislature)
    .catch(() => [] as WatchItem[]);
  const groups = await Promise.all([...councilFetches, legFetch]);
  return groups.flat();
}

export async function getCivicActivity(
  area: AreaContext,
  limit = 8,
): Promise<SourcedValue<CivicFeedItem[]>> {
  const label = [...area.councils.map((c) => c.label), "WA Legislature"].join(" · ");
  try {
    const items = await fetchAreaItems(area);
    const insights = await attachCachedInsights(items, area.key);
    let feed: CivicFeedItem[] = items.map((it) => ({
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
    } else {
      // No AI insights yet — show only keyword-topic matches (the prior behavior).
      feed = feed.filter((f) => f.topics.length > 0);
    }
    return {
      value: feed.slice(0, limit),
      source: label,
      fetchedAt: new Date().toISOString(),
      confidence: "live",
    };
  } catch {
    return unavailable(label);
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
