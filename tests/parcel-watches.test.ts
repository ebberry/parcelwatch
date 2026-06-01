import { describe, it, expect } from "vitest";
import {
  diffAssessment,
  diffSales,
  saleKey,
  type AssessmentSnapshot,
  type SalesSnapshot,
} from "@/lib/watches/parcel";
import type { RawSale } from "@/lib/adapters/kingcounty/sales";

const snap = (assessedTotal: number | null, taxYear: number | null = 2026): AssessmentSnapshot => ({
  assessedTotal,
  taxYear,
  land: null,
  improvement: null,
});

const sale = (pin: string, salePrice: number | null, saleDate: string | null): RawSale => ({
  pin,
  address: `${pin} RD`,
  saleDate,
  salePrice,
  propertyType: "NA",
  principalUse: "RESIDENTIAL",
  propertyClass: "Res-Improved property",
  improved: true,
  lat: 47.33,
  lon: -122.5,
});

describe("diffAssessment", () => {
  it("detects a real change in the assessed total with a signed delta", () => {
    const change = diffAssessment(snap(760000, 2026), snap(812000, 2027));
    expect(change).not.toBeNull();
    expect(change!.prevTotal).toBe(760000);
    expect(change!.newTotal).toBe(812000);
    expect(change!.deltaPct).toBeCloseTo(6.8, 1);
    expect(change!.taxYear).toBe(2027);
  });

  it("returns null when the total is unchanged (even if tax year ticks)", () => {
    expect(diffAssessment(snap(760000, 2026), snap(760000, 2027))).toBeNull();
  });

  it("returns null when either side has no assessed total", () => {
    expect(diffAssessment(snap(null), snap(760000))).toBeNull();
    expect(diffAssessment(snap(760000), snap(null))).toBeNull();
  });

  it("reports a decrease as a negative delta", () => {
    const change = diffAssessment(snap(800000), snap(720000));
    expect(change!.deltaPct).toBeCloseTo(-10, 1);
  });
});

describe("diffSales", () => {
  it("treats every sale as new against an empty baseline (seed case)", () => {
    const current = [sale("a", 900000, "2025-08-13"), sale("b", 585000, "2025-06-10")];
    const { newSales, snapshot } = diffSales({ seen: [] }, current);
    expect(newSales).toHaveLength(2);
    expect(snapshot.seen).toHaveLength(2);
  });

  it("surfaces only sales not already seen", () => {
    const prev: SalesSnapshot = { seen: [saleKey(sale("a", 900000, "2025-08-13"))] };
    const current = [sale("a", 900000, "2025-08-13"), sale("c", 700000, "2025-09-01")];
    const { newSales } = diffSales(prev, current);
    expect(newSales.map((s) => s.pin)).toEqual(["c"]);
  });

  it("returns no new sales when everything is already seen", () => {
    const current = [sale("a", 900000, "2025-08-13")];
    const prev: SalesSnapshot = { seen: current.map(saleKey) };
    expect(diffSales(prev, current).newSales).toHaveLength(0);
  });

  it("ignores sales missing a price or date", () => {
    const current = [sale("a", null, "2025-08-13"), sale("b", 585000, null)];
    expect(diffSales({ seen: [] }, current).newSales).toHaveLength(0);
  });

  it("merges prior keys into the snapshot so they aren't re-alerted", () => {
    const older = saleKey(sale("old", 500000, "2024-01-01"));
    const current = [sale("a", 900000, "2025-08-13")];
    const { snapshot } = diffSales({ seen: [older] }, current);
    expect(snapshot.seen).toContain(older);
    expect(snapshot.seen).toContain(saleKey(current[0]));
  });
});
