import { describe, it, expect } from "vitest";
import { summarizeFindings } from "@/lib/report/summary";
import type { AppealRecommendation } from "@/lib/appeals";
import type { FloodHazard } from "@/lib/adapters/fema";
import type { TaxCalendar } from "@/lib/tax/deadlines";
import type { NearbySites } from "@/lib/environment/nearby";

const rec = (over: Partial<AppealRecommendation> = {}): AppealRecommendation => ({
  shouldAppeal: true,
  strength: "moderate",
  currentAssessed: 760000,
  recommendedValue: 621000,
  rangeLow: 621000,
  rangeHigh: 700000,
  basis: "the neighborhood assessment ratio",
  reductionAmount: 139000,
  reductionPct: 18,
  indicators: [],
  caveats: [],
  ...over,
});

const flood = (over: Partial<FloodHazard> = {}): FloodHazard =>
  ({ mapped: true, floodZone: "AE", zoneSubtype: null, inSFHA: true, baseFloodElevationFt: null, firmId: null, ...over }) as FloodHazard;

const tax = (daysAway: number): TaxCalendar =>
  ({
    next: { label: "First-half property tax", date: "2026-04-30", dateLabel: "April 30, 2026", daysAway, passed: false, citation: "" },
  }) as TaxCalendar;

const epa = (distanceMi: number, count = 3): NearbySites => ({
  count,
  radiusMi: 2,
  nearest: [{ name: "Site", detail: null, distanceMi }],
});

const NONE = { recommendation: null, flood: null, seismic: null, epa: null, councilCount: 0, tax: null };

describe("summarizeFindings", () => {
  it("leads with the appeal opportunity when one is recommended", () => {
    const out = summarizeFindings({ ...NONE, recommendation: rec() });
    expect(out[0].id).toBe("appeal");
    expect(out[0].tone).toBe("opportunity");
    expect(out[0].title).toMatch(/over-assessed/);
    expect(out[0].href).toBe("#appeal");
  });

  it("does not surface an appeal when none is recommended", () => {
    const out = summarizeFindings({ ...NONE, recommendation: rec({ shouldAppeal: false }) });
    expect(out.find((f) => f.id === "appeal")).toBeUndefined();
  });

  it("folds the appeal deadline into the lead finding when it's near", () => {
    const taxWithAppeal = {
      appeal: { label: "appeal", date: "2026-07-01", dateLabel: "July 1, 2026", daysAway: 30, passed: false, citation: "" },
    } as TaxCalendar;
    const out = summarizeFindings({ ...NONE, recommendation: rec(), tax: taxWithAppeal });
    expect(out[0].title).toMatch(/file by July 1, 2026/);
  });

  it("orders money > flood > tax and caps at four findings", () => {
    const out = summarizeFindings({
      recommendation: rec(),
      flood: flood(),
      tax: tax(10),
      epa: epa(0.2),
      councilCount: 5,
      seismic: { count: 1, largest: { magnitude: 4.5 } } as never,
    });
    expect(out).toHaveLength(4);
    expect(out.map((f) => f.id)).toEqual(["appeal", "flood", "tax", "epa"]);
  });

  it("flags an imminent tax deadline as attention, a farther one as info", () => {
    expect(summarizeFindings({ ...NONE, tax: tax(10) })[0].tone).toBe("attention");
    expect(summarizeFindings({ ...NONE, tax: tax(25) })[0].tone).toBe("info");
    // Beyond 30 days, it isn't surfaced at all.
    expect(summarizeFindings({ ...NONE, tax: tax(40) })[0].id).toBe("clear");
  });

  it("only surfaces a regulated site when it's genuinely close (<= 0.5 mi)", () => {
    expect(summarizeFindings({ ...NONE, epa: epa(0.3) }).some((f) => f.id === "epa")).toBe(true);
    expect(summarizeFindings({ ...NONE, epa: epa(1.4) }).some((f) => f.id === "epa")).toBe(false);
  });

  it("falls back to a single 'all clear' finding when nothing qualifies", () => {
    const out = summarizeFindings(NONE);
    expect(out).toHaveLength(1);
    expect(out[0].tone).toBe("clear");
    expect(out[0].title).toMatch(/All clear/);
  });
});
