import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { watches, alerts as alertsTable, users, digestState } from "@/db/schema";
import { getWatchedParcels } from "@/lib/watches/service";
import { getParcelCore } from "@/lib/parcels/service";
import { titleCaseAddress } from "@/lib/format";
import { sendEmail } from "@/lib/email/send";
import { composeDigest, type DigestAlert, type DigestProperty } from "./compose";
import { digestToken } from "./token";

/**
 * The recurring-value loop: a monthly "what changed since you last looked"
 * digest. `runDueDigests` is meant to be ticked daily by the worker — the
 * per-user `lastDigestAt` enforces the ~monthly cadence, so a daily tick only
 * actually emails users who are due. Civic-centered (the alerts feed is built
 * from the council + legislature watches).
 */

const DAY = 24 * 60 * 60 * 1000;

function baseUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://parcelwatch.ebberry.com"
  ).replace(/\/$/, "");
}

export interface DigestRunResult {
  candidates: number;
  sent: number;
  skippedOptOut: number;
  notDue: number;
  noEmail: number;
  errors: number;
}

export async function runDueDigests(opts?: {
  now?: Date;
  minIntervalDays?: number;
}): Promise<DigestRunResult> {
  const db = getDb();
  const now = opts?.now ?? new Date();
  const minDays = opts?.minIntervalDays ?? 30;
  const cutoff = new Date(now.getTime() - minDays * DAY);

  // One row per user who has any active watch — with their email + digest state.
  const rows = await db
    .select({
      userId: watches.userId,
      email: users.email,
      lastDigestAt: digestState.lastDigestAt,
      optOut: digestState.optOut,
    })
    .from(watches)
    .innerJoin(users, eq(users.id, watches.userId))
    .leftJoin(digestState, eq(digestState.userId, watches.userId))
    .where(eq(watches.active, true))
    .groupBy(watches.userId, users.email, digestState.lastDigestAt, digestState.optOut);

  const result: DigestRunResult = {
    candidates: rows.length,
    sent: 0,
    skippedOptOut: 0,
    notDue: 0,
    noEmail: 0,
    errors: 0,
  };

  for (const r of rows) {
    if (r.optOut) {
      result.skippedOptOut++;
      continue;
    }
    if (!r.email) {
      result.noEmail++;
      continue;
    }
    const due = !r.lastDigestAt || r.lastDigestAt < cutoff;
    if (!due) {
      result.notDue++;
      continue;
    }
    try {
      await sendUserDigest(r.userId, r.email, r.lastDigestAt ?? cutoff, now);
      result.sent++;
    } catch (e) {
      console.error(`[digest] user ${r.userId} failed:`, e);
      result.errors++;
    }
  }
  return result;
}

/** The user's digest preferences/state — for the dashboard email card. */
export async function getDigestState(
  userId: string,
): Promise<{ optOut: boolean; lastDigestAt: Date | null }> {
  const db = getDb();
  const [row] = await db
    .select({ optOut: digestState.optOut, lastDigestAt: digestState.lastDigestAt })
    .from(digestState)
    .where(eq(digestState.userId, userId))
    .limit(1);
  return { optOut: row?.optOut ?? false, lastDigestAt: row?.lastDigestAt ?? null };
}

/**
 * Build + send one user's digest. Stamps lastDigestAt by default (cadence); a
 * "send me a test digest" from the dashboard passes stamp=false so testing
 * doesn't suppress the real monthly send.
 */
export async function sendUserDigest(
  userId: string,
  email: string,
  since: Date,
  now: Date,
  opts?: { stamp?: boolean },
): Promise<{ sent: boolean; alertCount: number }> {
  const db = getDb();

  // The user's saved addresses (parcel-scoped watches).
  const watched = await getWatchedParcels(userId);
  const properties: DigestProperty[] = [];
  for (const w of watched) {
    const core = (await getParcelCore(w.parcelId).catch(() => null))?.value ?? null;
    properties.push({
      parcelId: w.parcelId,
      address: titleCaseAddress(core?.address ?? null),
      city: titleCaseAddress(core?.city ?? null),
    });
  }

  // What changed since their last digest (the alerts the worker already logged).
  const aRows = await db
    .select()
    .from(alertsTable)
    .where(and(eq(alertsTable.userId, userId), gte(alertsTable.createdAt, since)))
    .orderBy(desc(alertsTable.createdAt))
    .limit(25);
  const digestAlerts: DigestAlert[] = aRows.map((a) => ({
    kind: a.kind,
    title: a.title,
    detail: a.detail,
    url: a.url,
    source: a.source,
  }));

  const url = baseUrl();
  const message = composeDigest({
    periodLabel: "this month",
    properties,
    alerts: digestAlerts,
    dashboardUrl: `${url}/dashboard`,
    unsubscribeUrl: `${url}/digest/unsubscribe?u=${encodeURIComponent(userId)}&t=${digestToken(userId)}`,
  });

  const { sent } = await sendEmail({ to: email, ...message });

  if (opts?.stamp !== false) {
    await db
      .insert(digestState)
      .values({ userId, lastDigestAt: now, optOut: false })
      .onConflictDoUpdate({ target: digestState.userId, set: { lastDigestAt: now } });
  }

  return { sent, alertCount: digestAlerts.length };
}

/** Honor an unsubscribe link (and let the dashboard re-enable). */
export async function setDigestOptOut(userId: string, optOut: boolean): Promise<void> {
  const db = getDb();
  await db
    .insert(digestState)
    .values({ userId, optOut })
    .onConflictDoUpdate({ target: digestState.userId, set: { optOut } });
}
