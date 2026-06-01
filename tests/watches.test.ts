import { describe, it, expect } from "vitest";
import { matchTopics } from "@/lib/watches/topics";
import { normalizeCouncil, type KcMatter } from "@/lib/watches/sources/council";

describe("matchTopics", () => {
  it("matches keywords case-insensitively and returns topic keys", () => {
    expect(matchTopics("An ordinance relating to SEPTIC systems")).toEqual(["septic"]);
    expect(matchTopics("Vashon shoreline restoration").sort()).toEqual(["shoreline", "vashon"]);
    expect(matchTopics("property tax levy for rural areas").sort()).toEqual([
      "property-tax",
      "rural",
    ]);
  });

  it("returns nothing for unrelated text", () => {
    expect(matchTopics("A motion confirming a district court appointment")).toEqual([]);
    expect(matchTopics(null)).toEqual([]);
  });
});

const matter = (over: Partial<KcMatter>): KcMatter => ({
  MatterId: 1,
  MatterFile: "2026-0001",
  MatterName: null,
  MatterTitle: null,
  MatterTypeName: "Ordinance",
  MatterStatusName: "In Committee",
  MatterBodyName: "Council",
  MatterIntroDate: "2026-05-01T00:00:00",
  ...over,
});

describe("normalizeCouncil", () => {
  it("keeps only topic-matching matters and tags them", () => {
    const out = normalizeCouncil([
      matter({ MatterId: 10, MatterName: "An ordinance relating to property tax exemptions" }),
      matter({ MatterId: 11, MatterName: "A motion on parking garages" }), // no topic
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].externalId).toBe("kc-matter-10");
    expect(out[0].topics).toContain("property-tax");
    expect(out[0].url).toContain("ID=10");
    expect(out[0].title).toContain("2026-0001:");
  });

  it("falls back to MatterTitle when MatterName is empty", () => {
    const out = normalizeCouncil([
      matter({ MatterId: 12, MatterName: "", MatterTitle: "AN ORDINANCE relating to shoreline master programs" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].topics).toContain("shoreline");
    expect(out[0].title).toMatch(/shoreline master programs/i);
  });

  it("builds detail from type + status", () => {
    const out = normalizeCouncil([
      matter({ MatterId: 13, MatterName: "septic regulation update", MatterTypeName: "Ordinance", MatterStatusName: "Passed" }),
    ]);
    expect(out[0].detail).toBe("Ordinance · Passed");
  });
});
