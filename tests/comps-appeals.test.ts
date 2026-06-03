import { describe, it, expect } from "vitest";
import { buildCompSet } from "@/lib/comps/service";
import { buildUniformityNarrative } from "@/lib/appeals";
import type { ParcelCore } from "@/lib/adapters/kingcounty/parcel";
import type { RawComparable } from "@/lib/adapters/kingcounty/comparables";
import compsFixture from "./fixtures/kingcounty-comparables.json";

function subject(overrides: Partial<ParcelCore> = {}): ParcelCore {
  return {
    pin: "0000000001",
    address: "1 SUBJECT ST",
    city: "VASHON",
    zip: "98070",
    lat: 47.3314667,
    lon: -122.50043043,
    lotSqFt: 44066,
    acres: 1.01,
    zoningCode: "RA-2.5",
    presentUseCode: 2,
    presentUse: "Single Family",
    propertyType: "R",
    platName: null,
    assessment: {
      appraisedLand: 414000,
      appraisedImprovement: 658000,
      appraisedTotal: 1072000,
      taxableLand: 414000,
      taxableImprovement: 658000,
      taxableTotal: 1072000,
      taxYear: 2026,
      levyCode: "4045",
      levyJurisdiction: "KING COUNTY",
      accountNumber: "012102900805",
    },
    ...overrides,
  };
}

const comp = (pin: string, lotSqFt: number, assessedTotal: number): RawComparable => ({
  pin,
  address: `${pin} COMP RD`,
  lotSqFt,
  assessedTotal,
  lat: 47.331,
  lon: -122.5,
});

describe("buildCompSet", () => {
  it("flags an over-assessed subject (per lot sq ft) as appearsHigh", () => {
    // Subject ≈ $24.3/sqft; comps ≈ $15-16/sqft.
    const raw = [
      comp("a", 20000, 300000), // 15.0
      comp("b", 25000, 400000), // 16.0
      comp("c", 30000, 450000), // 15.0
    ];
    const set = buildCompSet(subject(), raw);
    expect(set.comps).toHaveLength(3);
    expect(set.medianPerLotSqFt).toBeCloseTo(15, 0);
    expect(set.subjectVsMedianPct).toBeGreaterThan(40);
    expect(set.appearsHigh).toBe(true);
  });

  it("does not flag a subject in line with comps", () => {
    const raw = [
      comp("a", 40000, 980000), // 24.5
      comp("b", 45000, 1100000), // 24.4
      comp("c", 44000, 1070000), // 24.3
    ];
    const set = buildCompSet(subject(), raw);
    expect(set.appearsHigh).toBe(false);
  });

  it("excludes comps with missing values or wildly different lot sizes", () => {
    const raw = [
      comp("ok", 30000, 450000),
      comp("tiny", 5000, 200000), // < 0.4x subject lot -> excluded
      comp("huge", 200000, 3000000), // > 2.5x subject lot -> excluded
      { ...comp("nullval", 30000, 0), assessedTotal: null }, // no value -> excluded
    ];
    const set = buildCompSet(subject(), raw);
    expect(set.comps.map((c) => c.pin)).toEqual(["ok"]);
  });

  it("runs on the real comparables fixture", () => {
    const raw: RawComparable[] = (
      compsFixture as { features: { attributes: Record<string, number | string | null> }[] }
    ).features.map((f) => {
      const a = f.attributes;
      const land = (a.APPRLNDVAL as number) ?? 0;
      const impr = (a.APPR_IMPR as number) ?? 0;
      return {
        pin: a.PIN as string,
        address: (a.ADDR_FULL as string) ?? null,
        lotSqFt: (a.LOTSQFT as number) ?? null,
        assessedTotal: land + impr,
        lat: (a.LAT as number) ?? null,
        lon: (a.LON as number) ?? null,
      };
    });
    const set = buildCompSet(subject(), raw);
    expect(set.comps.length).toBeGreaterThan(0);
    expect(set.comps.length).toBeLessThanOrEqual(8);
    expect(set.medianAssessedTotal).toBeGreaterThan(0);
  });
});

describe("buildUniformityNarrative", () => {
  it("writes a grounds paragraph only when the subject appears high", () => {
    const high = buildCompSet(subject(), [
      comp("a", 20000, 300000),
      comp("b", 25000, 400000),
      comp("c", 30000, 450000),
    ]);
    const text = buildUniformityNarrative(high);
    expect(text).toMatch(/per lot square foot/);
    expect(text).toMatch(/uniform and equitable/);
  });

  it("returns null when the data doesn't support a uniformity claim", () => {
    const inline = buildCompSet(subject(), [
      comp("a", 44000, 1070000),
      comp("b", 45000, 1100000),
    ]);
    expect(buildUniformityNarrative(inline)).toBeNull();
  });
});
