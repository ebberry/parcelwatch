import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { watches, alerts } from "@/db/schema";
import { fetchCouncilItems } from "./sources/council";
import { unavailable, type SourcedValue } from "@/lib/provenance";
import type { WatchItem } from "./index";

const COUNCIL_LABEL = "King County Council (Legistar)";

/**
 * Live "what's in motion" — current King County Council legislation matching
 * tracked topics. This is the always-on display; the durable alert feed (below)
 * is what diffs over time. Degrades to unavailable if Legistar is unreachable.
 */
export async function getCouncilActivity(limit = 8): Promise<SourcedValue<WatchItem[]>> {
  try {
    const items = await fetchCouncilItems();
    return {
      value: items.slice(0, limit),
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
