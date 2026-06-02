import { describe, it, expect } from "vitest";
import { normalizeNri } from "@/lib/adapters/fema/nri";

describe("normalizeNri", () => {
  it("extracts the composite + ranks notable hazards by score, dropping low ones", () => {
    const r = normalizeNri({
      TRACT: "027702",
      RISK_SCORE: 84.2,
      RISK_RATNG: "Relatively Moderate",
      RISK_SPCTL: 71,
      EAL_VALT: 3690271,
      ERQK_RISKR: "Relatively High",
      ERQK_RISKS: 80,
      LNDS_RISKR: "Relatively Moderate",
      LNDS_RISKS: 55,
      WFIR_RISKR: "Relatively Low", // dropped (not notable)
      WFIR_RISKS: 20,
      VLCN_RISKR: "Very Low", // dropped
      VLCN_RISKS: 5,
    });
    expect(r.compositeRating).toBe("Relatively Moderate");
    expect(r.compositeScore).toBeCloseTo(84.2, 1);
    expect(r.statePercentile).toBe(71);
    expect(r.ealTotal).toBe(3690271);
    // Notable hazards only, earthquake first (highest score).
    expect(r.topHazards.map((h) => h.name)).toEqual(["Earthquake", "Landslide"]);
    expect(r.topHazards[0].rating).toBe("Relatively High");
  });

  it("handles a tract with no notable hazards", () => {
    const r = normalizeNri({ RISK_RATNG: "Very Low", WFIR_RISKR: "Very Low", WFIR_RISKS: 3 });
    expect(r.topHazards).toEqual([]);
    expect(r.compositeRating).toBe("Very Low");
  });
});
