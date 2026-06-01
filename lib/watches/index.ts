/**
 * The watches — standing monitors that diff a source against last-seen state and
 * emit alerts (project brief §6). Two shapes:
 *  - JURISDICTION feeds (council, legislature): poll a list, diff global ids,
 *    fan out to topic subscribers.
 *  - PARCEL state-diffs (assessment, sales): for one parcel, compare the current
 *    state to a per-watch snapshot and alert the owner on change.
 *
 * Recorder/permit watches remain deferred — King County exposes no API (Accela /
 * Landmark are interactive portals whose terms forbid scraping; see
 * /docs/data-sources.md).
 *
 * Privacy: built-environment facts only — assessed values, sales, legislation by
 * topic — never data keyed to a person by name.
 */

export type WatchKind = "council" | "legislature" | "assessment" | "sales";

/** Kinds that diff a jurisdiction-wide feed and fan out to many subscribers. */
export const JURISDICTION_KINDS = ["council", "legislature"] as const;
export type JurisdictionWatchKind = (typeof JURISDICTION_KINDS)[number];

/** Kinds scoped to one parcel, diffed against a per-watch snapshot. */
export const PARCEL_KINDS = ["assessment", "sales"] as const;
export type ParcelWatchKind = (typeof PARCEL_KINDS)[number];

export function isParcelKind(kind: string): kind is ParcelWatchKind {
  return (PARCEL_KINDS as readonly string[]).includes(kind);
}

/** Human label for every watch kind (UI + alert source line). */
export const WATCH_KIND_LABEL: Record<WatchKind, string> = {
  council: "King County Council activity",
  legislature: "WA Legislature activity",
  assessment: "Assessment changes",
  sales: "Nearby sales",
};

/** A single item surfaced by a jurisdiction feed (a council matter, a bill). */
export interface WatchItem {
  kind: JurisdictionWatchKind;
  /** Stable id from the source, used for diffing (only alert on new ids). */
  externalId: string;
  title: string;
  /** Secondary line, e.g. type + status. */
  detail: string | null;
  /** Full source text (e.g. the legal MatterTitle) — grounding for AI summaries. */
  fullText: string | null;
  /** Human-readable source label, e.g. "Seattle City Council (Legistar)". */
  source: string;
  url: string | null;
  /** ISO date the item was introduced/updated. */
  date: string | null;
  /** Topic keys this item matched. */
  topics: string[];
}

export { TOPICS, type Topic, topicLabel, matchTopics } from "./topics";
