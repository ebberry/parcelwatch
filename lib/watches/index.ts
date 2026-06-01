/**
 * The watches — the subscription moat (project brief §6, Slice 5).
 *
 * Scheduled pollers fetch a source, diff against last-seen state, and emit a
 * user-facing alert carrying provenance. Built in Phase 5 on BullMQ workers
 * (see /jobs). Phase 0 defines the shape only.
 *
 * Privacy: the recorder/title watch is owner-consented and the OWNER'S parcel
 * only. We never compile or expose information keyed to third parties by name.
 */

export type WatchKind =
  | "permits-nearby"
  | "title-recorder" // owner's own parcel only
  | "council-agenda"
  | "legislature-bills";

export interface WatchAlert {
  kind: WatchKind;
  title: string;
  detail: string;
  source: string;
  /** ISO timestamp this change was observed. */
  observedAt: string;
}

export interface Watch<TState> {
  kind: WatchKind;
  /** Fetch current state, diff against `previous`, return any new alerts. */
  poll(previous: TState | null): Promise<{ state: TState; alerts: WatchAlert[] }>;
}
