import { describe, it, expect } from "vitest";
import { matchTopics } from "@/lib/watches/topics";
import { normalizeLegistar, type LegistarMatter } from "@/lib/watches/sources/legistar";

const KC = { client: "kingcounty", sourceLabel: "King County Council (Legistar)" };

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

const matter = (over: Partial<LegistarMatter>): LegistarMatter => ({
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

describe("normalizeLegistar", () => {
  it("keeps ALL matters (AI relevance gates, not keywords) and tags topics", () => {
    const out = normalizeLegistar(
      [
        matter({ MatterId: 10, MatterName: "An ordinance relating to property tax exemptions" }),
        matter({ MatterId: 11, MatterName: "A motion on parking garages" }), // no topic — still kept
      ],
      KC,
    );
    expect(out).toHaveLength(2);
    expect(out[0].externalId).toBe("kingcounty-matter-10");
    expect(out[0].topics).toContain("property-tax");
    expect(out[1].topics).toEqual([]); // kept, just no topic pills
    expect(out[0].url).toContain("ID=10");
    expect(out[0].title).toContain("2026-0001:");
    expect(out[0].source).toBe(KC.sourceLabel);
  });

  it("prefixes the externalId with the client (so cities don't collide)", () => {
    const out = normalizeLegistar([matter({ MatterId: 5, MatterName: "A Seattle ordinance" })], { client: "seattle", sourceLabel: "Seattle City Council (Legistar)" });
    expect(out[0].externalId).toBe("seattle-matter-5");
    expect(out[0].url).toContain("seattle.legistar.com");
  });

  it("falls back to MatterTitle when MatterName is empty", () => {
    const out = normalizeLegistar(
      [matter({ MatterId: 12, MatterName: "", MatterTitle: "AN ORDINANCE relating to shoreline master programs" })],
      KC,
    );
    expect(out).toHaveLength(1);
    expect(out[0].topics).toContain("shoreline");
    expect(out[0].title).toMatch(/shoreline master programs/i);
  });

  it("builds detail from type + status", () => {
    const out = normalizeLegistar(
      [matter({ MatterId: 13, MatterName: "septic regulation update", MatterTypeName: "Ordinance", MatterStatusName: "Passed" })],
      KC,
    );
    expect(out[0].detail).toBe("Ordinance · Passed");
  });
});
