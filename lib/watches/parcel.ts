import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { watches, alerts } from "@/db/schema";
import { getParcelCore } from "@/lib/parcels/service";
import { searchNearbySales, type RawSale } from "@/lib/adapters/kingcounty/sales";
import { eRealPropertyUrl, type ParcelCore } from "@/lib/adapters/kingcounty/parcel";
import { haversineKm, kmToMiles } from "@/lib/geo";
import { PARCEL_KINDS } from "./index";

/**
 * Parcel change-watches — the recurring-value core. For a watched parcel we
 * compare the CURRENT state to a per-watch snapshot and alert the owner when it
 * changes:
 *  - `assessment`: the county's assessed value changed (a reassessment) — often
 *    the trigger to appeal.
 *  - `sales`: a new comparable sale appeared nearby — fresh appeal evidence and
 *    a market signal.
 *
 * Honest by construction: alerts fire only on a real, observed delta against the
 * stored baseline; the first poll seeds the baseline silently. Built-environment
 * facts only — never owner names (see /docs/privacy.md).
 */

const RADIUS_METERS = 1600; // ~1 mile, matches the comps engine
const SALES_SEEN_CAP = 200; // bound the per-watch seen-set

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

function fmtDate(iso: string | null): string {
  if (!iso) return "an earlier date";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m >= 1 && m <= 12 ? `${months[m - 1]} ${d}, ${y}` : String(y);
}

// ---------------------------------------------------------------------------
// Snapshots + pure diff logic (exported for tests)
// ---------------------------------------------------------------------------

export interface AssessmentSnapshot {
  assessedTotal: number | null;
  taxYear: number | null;
  land: number | null;
  improvement: number | null;
}

export interface AssessmentChange {
  prevTotal: number;
  newTotal: number;
  deltaPct: number | null;
  taxYear: number | null;
}

export function assessmentSnapshot(core: ParcelCore): AssessmentSnapshot {
  return {
    assessedTotal: core.assessment?.appraisedTotal ?? null,
    taxYear: core.assessment?.taxYear ?? null,
    land: core.assessment?.appraisedLand ?? null,
    improvement: core.assessment?.appraisedImprovement ?? null,
  };
}

/** A real change in the assessed TOTAL (ignore taxYear-only or null states). */
export function diffAssessment(
  prev: AssessmentSnapshot,
  curr: AssessmentSnapshot,
): AssessmentChange | null {
  if (prev.assessedTotal == null || curr.assessedTotal == null) return null;
  if (prev.assessedTotal === curr.assessedTotal) return null;
  const deltaPct =
    prev.assessedTotal > 0
      ? Math.round(((curr.assessedTotal - prev.assessedTotal) / prev.assessedTotal) * 1000) / 10
      : null;
  return {
    prevTotal: prev.assessedTotal,
    newTotal: curr.assessedTotal,
    deltaPct,
    taxYear: curr.taxYear,
  };
}

export interface SalesSnapshot {
  seen: string[];
}

/** Stable identity for a recorded sale (no excise number in our fields). */
export function saleKey(s: Pick<RawSale, "pin" | "saleDate" | "salePrice">): string {
  return `${s.pin}:${s.saleDate ?? "?"}:${s.salePrice ?? "?"}`;
}

/** New sales = those not in the seen-set; returns the merged, capped snapshot. */
export function diffSales(
  prev: SalesSnapshot,
  current: RawSale[],
): { newSales: RawSale[]; snapshot: SalesSnapshot } {
  const seen = new Set(prev.seen ?? []);
  const valid = current.filter((s) => s.salePrice != null && s.saleDate != null);
  const newSales = valid.filter((s) => !seen.has(saleKey(s)));
  // Keep the most-recently-relevant keys (current set ∪ prior), capped.
  const merged = [...new Set([...valid.map(saleKey), ...(prev.seen ?? [])])].slice(-SALES_SEEN_CAP);
  return { newSales, snapshot: { seen: merged } };
}

// ---------------------------------------------------------------------------
// Engine (DB + network)
// ---------------------------------------------------------------------------

export interface ParcelPollResult {
  watches: number;
  seeded: number;
  changed: number;
  alertsCreated: number;
}

type WatchRow = typeof watches.$inferSelect;

async function setSnapshot(
  id: number,
  snapshot: AssessmentSnapshot | SalesSnapshot,
): Promise<void> {
  await getDb()
    .update(watches)
    .set({ snapshot: snapshot as unknown as Record<string, unknown> })
    .where(eq(watches.id, id));
}

async function assessmentAlert(sub: WatchRow, change: AssessmentChange, core: ParcelCore): Promise<void> {
  const dir = change.newTotal > change.prevTotal ? "rose" : "fell";
  const pct = change.deltaPct == null ? "" : ` (${change.deltaPct > 0 ? "+" : ""}${change.deltaPct}%)`;
  const yr = change.taxYear ? ` for the ${change.taxYear} tax year` : "";
  await getDb().insert(alerts).values({
    userId: sub.userId,
    parcelId: sub.parcelId,
    kind: "assessment",
    title: `Assessed value ${dir}: ${usd(change.prevTotal)} → ${usd(change.newTotal)}${pct}`,
    detail:
      change.newTotal > change.prevTotal
        ? `King County raised this assessment${yr}. A higher assessed value usually means a higher tax bill — you may be able to appeal.`
        : `King County lowered this assessment${yr}.`,
    url: eRealPropertyUrl(core.pin),
    source: "King County Assessor",
    topics: [],
    observedAt: new Date(),
  });
}

async function saleAlert(sub: WatchRow, sale: RawSale, core: ParcelCore): Promise<void> {
  const distMi =
    core.lat != null && core.lon != null && sale.lat != null && sale.lon != null
      ? Math.round(kmToMiles(haversineKm(core.lat, core.lon, sale.lat, sale.lon)) * 10) / 10
      : null;
  const where = distMi != null ? ` · ${distMi} mi away` : "";
  await getDb().insert(alerts).values({
    userId: sub.userId,
    parcelId: sub.parcelId,
    kind: "sales",
    title: `New nearby sale: ${sale.address ?? sale.pin} — ${usd(sale.salePrice)}`,
    detail: `Sold ${fmtDate(sale.saleDate)}${where}. A fresh comparable for your assessment and any appeal.`,
    url: eRealPropertyUrl(sale.pin),
    source: "King County recorded sales",
    topics: [],
    observedAt: sale.saleDate ? new Date(sale.saleDate) : null,
  });
}

/**
 * Poll every active parcel-scoped watch: fetch the parcel's current state once,
 * diff each watch against its snapshot, alert on change, and advance the
 * snapshot. The first poll for a watch seeds its baseline silently.
 */
export async function runParcelWatches(): Promise<ParcelPollResult> {
  const db = getDb();
  const subs = await db
    .select()
    .from(watches)
    .where(and(eq(watches.active, true), inArray(watches.kind, [...PARCEL_KINDS])));

  const byParcel = new Map<string, WatchRow[]>();
  for (const s of subs) {
    if (!s.parcelId) continue;
    const list = byParcel.get(s.parcelId) ?? [];
    list.push(s);
    byParcel.set(s.parcelId, list);
  }

  let seeded = 0;
  let changed = 0;
  let alertsCreated = 0;

  for (const [parcelId, parcelSubs] of byParcel) {
    const core = (await getParcelCore(parcelId)).value;
    if (!core) continue; // parcel unavailable this cycle — retry next poll

    // Fetch nearby sales once if any sales watch needs them.
    let nearby: RawSale[] = [];
    if (parcelSubs.some((s) => s.kind === "sales") && core.lat != null && core.lon != null) {
      try {
        nearby = await searchNearbySales({
          lat: core.lat,
          lon: core.lon,
          radiusMeters: RADIUS_METERS,
          excludePin: core.pin,
          limit: 60,
        });
      } catch {
        nearby = [];
      }
    }

    for (const sub of parcelSubs) {
      if (sub.kind === "assessment") {
        const curr = assessmentSnapshot(core);
        const prev = (sub.snapshot as AssessmentSnapshot | null) ?? null;
        if (!prev) {
          await setSnapshot(sub.id, curr);
          seeded++;
          continue;
        }
        const change = diffAssessment(prev, curr);
        if (change) {
          await assessmentAlert(sub, change, core);
          await setSnapshot(sub.id, curr);
          changed++;
          alertsCreated++;
        }
      } else if (sub.kind === "sales") {
        if (core.lat == null || core.lon == null) continue;
        const prev = (sub.snapshot as SalesSnapshot | null) ?? null;
        const { newSales, snapshot } = diffSales(prev ?? { seen: [] }, nearby);
        if (!prev) {
          await setSnapshot(sub.id, snapshot);
          seeded++;
          continue;
        }
        if (newSales.length) {
          for (const s of newSales) {
            await saleAlert(sub, s, core);
            alertsCreated++;
          }
          changed++;
        }
        await setSnapshot(sub.id, snapshot);
      }
    }
  }

  return { watches: subs.length, seeded, changed, alertsCreated };
}
