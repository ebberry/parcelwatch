/**
 * Washington property-tax deadlines are RULES we compute, not a data feed
 * (project brief §6, Slice 2). Pure and deterministic so they can be unit-tested
 * against many reference dates.
 *
 * Date math is done in UTC on calendar dates (no time-of-day). WA is Pacific
 * time; for whole-day deadlines this is accurate to within a day near midnight —
 * a Pacific-time refinement is a known TODO, noted in the UI disclaimer.
 *
 * Citations:
 *  - First/second-half due dates (Apr 30 / Oct 31): RCW 84.56.020.
 *  - Board of Equalization appeal window: RCW 84.40.038.
 */

const MS_PER_DAY = 86_400_000;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface Deadline {
  label: string;
  /** Calendar date as YYYY-MM-DD. */
  date: string;
  /** Human label, e.g. "April 30, 2026". */
  dateLabel: string;
  /** Whole days from the reference date; negative once the date has passed. */
  daysAway: number;
  passed: boolean;
  citation: string;
  note?: string;
}

export interface TaxCalendar {
  /** First-half property tax — due April 30. */
  firstHalf: Deadline;
  /** Second-half property tax — due October 31. */
  secondHalf: Deadline;
  /** Board of Equalization appeal — statutory floor of July 1. */
  appeal: Deadline;
  /** Soonest upcoming property-tax payment deadline. */
  next: Deadline;
}

/** Midnight-UTC epoch ms for a calendar date. monthIndex is 0-based. */
function dayMs(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day);
}

function toCalendarMs(now: Date): number {
  return dayMs(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function makeDeadline(
  label: string,
  year: number,
  monthIndex: number,
  day: number,
  nowMs: number,
  citation: string,
  note?: string,
): Deadline {
  const targetMs = dayMs(year, monthIndex, day);
  const daysAway = Math.round((targetMs - nowMs) / MS_PER_DAY);
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return {
    label,
    date: `${year}-${mm}-${dd}`,
    dateLabel: `${MONTHS[monthIndex]} ${day}, ${year}`,
    daysAway,
    passed: daysAway < 0,
    citation,
    note,
  };
}

const DUE_DATE_CITATION = "RCW 84.56.020";
const APPEAL_CITATION = "RCW 84.40.038";
const WEEKEND_NOTE =
  "If a deadline falls on a weekend or legal holiday, it moves to the next business day.";

/**
 * Compute the active property-tax cycle + appeal deadline relative to `now`.
 * The "active cycle" is the current year through Oct 31; after Oct 31 it rolls
 * to next year (both halves upcoming).
 */
export function computeTaxCalendar(now: Date): TaxCalendar {
  const nowMs = toCalendarMs(now);
  const year = now.getUTCFullYear();

  // After Oct 31, the next payable cycle is next year.
  const octThisYear = dayMs(year, 9, 31);
  const cycleYear = nowMs > octThisYear ? year + 1 : year;

  const firstHalf = makeDeadline(
    "First-half property tax",
    cycleYear,
    3, // April
    30,
    nowMs,
    DUE_DATE_CITATION,
    WEEKEND_NOTE,
  );
  const secondHalf = makeDeadline(
    "Second-half property tax",
    cycleYear,
    9, // October
    31,
    nowMs,
    DUE_DATE_CITATION,
    WEEKEND_NOTE,
  );

  // Appeal: July 1 of the assessment year, or 60 days from the value notice,
  // whichever is later. We surface the next July 1 statutory floor.
  const julyFirstThisYear = dayMs(year, 6, 1);
  const appealYear = nowMs > julyFirstThisYear ? year + 1 : year;
  const appeal = makeDeadline(
    "Assessed-value appeal (Board of Equalization)",
    appealYear,
    6, // July
    1,
    nowMs,
    APPEAL_CITATION,
    "Or within 60 days of the date on your official Property Value Notice, whichever is later — check your notice for the exact date.",
  );

  // Next upcoming payment deadline (today counts as still due).
  const next = !firstHalf.passed ? firstHalf : secondHalf;

  return { firstHalf, secondHalf, appeal, next };
}
