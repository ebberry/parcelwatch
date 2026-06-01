import { describe, it, expect } from "vitest";
import { computeTaxCalendar } from "@/lib/tax/deadlines";

const at = (iso: string) => new Date(iso);

describe("computeTaxCalendar", () => {
  it("late May: first half passed, next is the Oct 31 second half (same year)", () => {
    const cal = computeTaxCalendar(at("2026-05-31T12:00:00Z"));
    expect(cal.firstHalf.date).toBe("2026-04-30");
    expect(cal.firstHalf.passed).toBe(true);
    expect(cal.secondHalf.date).toBe("2026-10-31");
    expect(cal.secondHalf.passed).toBe(false);
    expect(cal.next.label).toBe(cal.secondHalf.label);
  });

  it("early April: next is the first half, nothing passed yet", () => {
    const cal = computeTaxCalendar(at("2026-04-01T12:00:00Z"));
    expect(cal.firstHalf.passed).toBe(false);
    expect(cal.next.label).toBe(cal.firstHalf.label);
    expect(cal.firstHalf.daysAway).toBe(29);
  });

  it("after Oct 31 rolls the cycle to next year (both halves upcoming)", () => {
    const cal = computeTaxCalendar(at("2026-11-15T12:00:00Z"));
    expect(cal.firstHalf.date).toBe("2027-04-30");
    expect(cal.secondHalf.date).toBe("2027-10-31");
    expect(cal.firstHalf.passed).toBe(false);
    expect(cal.next.label).toBe(cal.firstHalf.label);
  });

  it("treats the due date itself as still due (daysAway 0, not passed)", () => {
    const cal = computeTaxCalendar(at("2026-10-31T00:00:00Z"));
    expect(cal.secondHalf.daysAway).toBe(0);
    expect(cal.secondHalf.passed).toBe(false);
    expect(cal.next.label).toBe(cal.secondHalf.label);
  });

  it("appeal deadline is the next July 1 with the BOE citation", () => {
    const before = computeTaxCalendar(at("2026-05-31T12:00:00Z"));
    expect(before.appeal.date).toBe("2026-07-01");
    expect(before.appeal.citation).toBe("RCW 84.40.038");

    const after = computeTaxCalendar(at("2026-08-01T12:00:00Z"));
    expect(after.appeal.date).toBe("2027-07-01");
  });

  it("cites RCW 84.56.020 for payment due dates and carries the weekend note", () => {
    const cal = computeTaxCalendar(at("2026-05-31T12:00:00Z"));
    expect(cal.firstHalf.citation).toBe("RCW 84.56.020");
    expect(cal.secondHalf.note).toMatch(/weekend or legal holiday/i);
  });
});
