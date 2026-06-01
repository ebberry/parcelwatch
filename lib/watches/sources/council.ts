import type { WatchItem } from "@/lib/watches";
import { fetchLegistarMatters } from "./legistar";

/**
 * King County Council source — now a thin wrapper over the generic Legistar
 * adapter (the same API serves KC and many WA cities). The keyword gate is gone;
 * the AI relevance layer decides what's worth surfacing. Verified 2026-05-31.
 */

export const KC_COUNCIL_LABEL = "King County Council (Legistar)";

/** Fetch recent King County Council legislation (no keyword gate). */
export function fetchCouncilItems(limit = 60): Promise<WatchItem[]> {
  return fetchLegistarMatters("kingcounty", KC_COUNCIL_LABEL, limit);
}
