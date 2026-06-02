import { describe, it, expect } from "vitest";
import { classifyPlumeBand } from "@/lib/adapters/waecology/smelterPlume";
import { summarizeFindings } from "@/lib/report/summary";

const NONE = {
  recommendation: null,
  flood: null,
  seismic: null,
  siteRisk: null,
  epa: null,
  councilCount: 0,
  tax: null,
};

describe("classifyPlumeBand", () => {
  it("maps Ecology band names to severity against the reference levels", () => {
    expect(classifyPlumeBand("Over 100 ppm")).toBe("above-action");
    expect(classifyPlumeBand("40.1 ppm to 100 ppm")).toBe("above-cleanup");
    expect(classifyPlumeBand("20 ppm to 40 ppm")).toBe("above-cleanup");
    expect(classifyPlumeBand("Under 20 ppm")).toBe("below-cleanup");
    expect(classifyPlumeBand("Limited Data")).toBe("unmodeled");
    expect(classifyPlumeBand("Military Base/State Facility")).toBe("unmodeled");
    expect(classifyPlumeBand(null)).toBe("unmodeled");
  });
});

describe("soil-contamination finding", () => {
  it("surfaces above-action soil arsenic in the synthesis header", () => {
    const out = summarizeFindings({
      ...NONE,
      soil: { band: "Over 100 ppm", severity: "above-action", milesFromSmelter: 3.1 },
    });
    const f = out.find((x) => x.id === "soil");
    expect(f).toBeDefined();
    expect(f!.title).toMatch(/soil arsenic/i);
  });

  it("does not surface for below-action bands", () => {
    const out = summarizeFindings({
      ...NONE,
      soil: { band: "40.1 ppm to 100 ppm", severity: "above-cleanup", milesFromSmelter: 6 },
    });
    expect(out.find((x) => x.id === "soil")).toBeUndefined();
  });
});
