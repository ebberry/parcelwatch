import { computeTaxCalendar, type TaxCalendar } from "./deadlines";
import type { SourcedValue } from "@/lib/provenance";

export type { TaxCalendar, Deadline } from "./deadlines";

/**
 * The tax calendar is computed from statute, so it is authoritative —
 * confidence "confirmed". The source label names the rules, and `fetchedAt`
 * records when we computed it (not a remote fetch).
 */
export function getTaxCalendar(now: Date = new Date()): SourcedValue<TaxCalendar> {
  return {
    value: computeTaxCalendar(now),
    source: "Computed from WA statute (RCW 84.56.020, 84.40.038)",
    fetchedAt: now.toISOString(),
    confidence: "confirmed",
  };
}
