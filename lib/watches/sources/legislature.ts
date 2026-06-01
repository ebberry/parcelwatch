import type { WatchItem } from "@/lib/watches";
import { matchTopics } from "@/lib/watches/topics";

/**
 * WA State Legislature watch source.
 *
 * Keyless ASMX/XML (verified 2026-05-31). Session runs roughly Jan–Apr; outside
 * session GetLegislationIntroducedSince returns 0 bills → the poller does nothing.
 * During session we fetch bills introduced since the last poll, then get each
 * bill's description to topic-match before alerting. See /docs/data-sources.md.
 *
 * Uses regex-based XML extraction (no extra deps) — the WA Leg XML is
 * well-structured SOAP output, safe to parse this way.
 */

const WSL_BASE = "https://wslwebservices.leg.wa.gov/legislationservice.asmx";
const BIENNIUM = "2025-26";
/** Bills introduced at most this many days ago on the first poll (caps catch-up). */
const MAX_LOOKBACK_DAYS = 14;

/** Extract the inner text of a single XML tag. */
function tagText(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() || null : null;
}

/** Extract all occurrences of a repeating element as raw XML strings. */
function allElements(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g");
  return xml.match(re) ?? [];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`WA Legislature HTTP ${res.status}`);
  return res.text();
}

export interface WaLegBill {
  billId: string;
  billNumber: string;
  biennium: string;
  shortDescription: string | null;
  longDescription: string | null;
  currentStatus: string | null;
}

/** Fetch bills introduced since `sinceDate` (ISO date string, e.g. "2026-01-15"). */
export async function fetchNewBills(sinceDate: string): Promise<WaLegBill[]> {
  const listXml = await fetchText(
    `${WSL_BASE}/GetLegislationIntroducedSince?sinceDate=${encodeURIComponent(sinceDate)}`,
  );
  const infoBlocks = allElements(listXml, "LegislationInfo");
  if (!infoBlocks.length) return [];

  const bills = await Promise.all(
    infoBlocks.map(async (block) => {
      const billNum = tagText(block, "BillNumber");
      if (!billNum) return null;
      try {
        const detail = await fetchText(
          `${WSL_BASE}/GetLegislation?biennium=${BIENNIUM}&billNumber=${billNum}`,
        );
        const legBlock = allElements(detail, "Legislation")[0] ?? detail;
        return {
          billId: tagText(legBlock, "BillId") ?? `Bill ${billNum}`,
          billNumber: billNum,
          biennium: BIENNIUM,
          shortDescription: tagText(legBlock, "ShortDescription"),
          longDescription: tagText(legBlock, "LongDescription"),
          currentStatus: tagText(legBlock, "CurrentStatus"),
        } satisfies WaLegBill;
      } catch {
        return null;
      }
    }),
  );
  return bills.filter(Boolean) as WaLegBill[];
}

/** Pure normalizer: map bills → WatchItems, keep only topic matches. */
export function normalizeLegislature(bills: WaLegBill[]): WatchItem[] {
  const items: WatchItem[] = [];
  for (const b of bills) {
    const searchText = [b.shortDescription, b.longDescription]
      .filter(Boolean)
      .join(" ");
    const topics = matchTopics(searchText);
    if (!topics.length) continue;
    items.push({
      kind: "legislature",
      externalId: `wa-leg-${b.biennium}-${b.billId.replace(/\s+/g, "-")}`,
      title: `${b.billId}: ${b.shortDescription ?? b.longDescription ?? "No description"}`,
      detail: b.currentStatus ?? null,
      fullText: b.longDescription ?? null,
      source: "WA Legislature web services",
      url: `https://app.leg.wa.gov/billsummary?BillNumber=${b.billNumber}&Year=${b.biennium.slice(0, 4)}&Initiative=false`,
      date: null,
      topics,
    });
  }
  return items;
}

/** Compute the since-date for this poll (capped lookback on first run). */
export function sinceDate(nowMs: number = Date.now()): string {
  return new Date(nowMs - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
