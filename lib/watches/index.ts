/**
 * The watches — standing monitors that poll a source, diff against last-seen
 * state, and emit alerts (project brief §6, Slice 5). Built on the verified
 * keyless sources: King County Council (Legistar) and the WA Legislature.
 *
 * Permits and recorder watches are deferred — King County exposes no API for
 * either (Accela / Landmark are interactive portals whose terms forbid scraping;
 * see /docs/data-sources.md).
 *
 * Privacy: these watches track public legislation/agendas by topic, not people.
 */

export type WatchKind = "council" | "legislature";

/** A single item surfaced by a source (a council matter, a bill). */
export interface WatchItem {
  kind: WatchKind;
  /** Stable id from the source, used for diffing (only alert on new ids). */
  externalId: string;
  title: string;
  /** Secondary line, e.g. type + status. */
  detail: string | null;
  url: string | null;
  /** ISO date the item was introduced/updated. */
  date: string | null;
  /** Topic keys this item matched. */
  topics: string[];
}

export { TOPICS, type Topic, topicLabel, matchTopics } from "./topics";
