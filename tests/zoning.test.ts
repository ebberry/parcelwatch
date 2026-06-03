import { describe, it, expect } from "vitest";
import { parseZone, analyzeZoning, incorporatedAnalysis } from "@/lib/zoning";

describe("incorporatedAnalysis — city parcels don't get King County rules", () => {
  it("names the city, asserts no county standards, and flags Title 21A as N/A", () => {
    const z = incorporatedAnalysis("Seattle", "NR3");
    expect(z.governedBy).toBe("Seattle");
    expect(z.recognized).toBe(false);
    expect(z.answers).toHaveLength(0);
    expect(z.standards).toHaveLength(0);
    expect(z.notes.join(" ")).toMatch(/City of Seattle/);
    expect(z.notes.join(" ")).toMatch(/Title 21A does not apply/i);
    // The Assessor's recorded city code is surfaced only as a labeled hint.
    expect(z.notes.join(" ")).toMatch(/NR3/);
  });

  it("works without a recorded code", () => {
    const z = incorporatedAnalysis("Burien");
    expect(z.governedBy).toBe("Burien");
    expect(z.zoneCode).toBe("—");
    expect(z.notes.join(" ")).not.toMatch(/records list/);
  });
});

function find(answers: ReturnType<typeof analyzeZoning>["answers"], q: RegExp) {
  const a = answers.find((x) => q.test(x.question));
  if (!a) throw new Error(`no answer matching ${q}`);
  return a;
}

describe("parseZone", () => {
  it("splits RA zones and overlay suffixes", () => {
    expect(parseZone("RA-2.5")).toEqual({ base: "RA-2.5", overlays: [] });
    expect(parseZone("RA-2.5-SO")).toEqual({ base: "RA-2.5", overlays: ["SO"] });
    expect(parseZone("RA-10")).toEqual({ base: "RA-10", overlays: [] });
  });

  it("handles residential and unknown codes", () => {
    expect(parseZone("R-4")).toEqual({ base: "R-4", overlays: [] });
    expect(parseZone("R6").base).toBe("R-6");
    expect(parseZone("F").base).toBe("F");
  });
});

describe("analyzeZoning — RA-2.5, small lot (1.01 ac, the Vashon sample)", () => {
  const z = analyzeZoning("RA-2.5", 1.01);

  it("is recognized as a Rural Area zone", () => {
    expect(z.recognized).toBe(true);
    expect(z.zoneName).toBe("Rural Area");
  });

  it("ADU is conditional below the min lot area, citing the verified section", () => {
    const adu = find(z.answers, /ADU/);
    expect(adu.verdict).toBe("conditional");
    expect(adu.citation).toBe("KCC 21A.08.030.B.7");
    expect(adu.explanation).toMatch(/below the ~1\.875-acre minimum/);
  });

  it("subdivision is 'no' for a lot under twice the minimum", () => {
    const sub = find(z.answers, /subdivide/i);
    expect(sub.verdict).toBe("no");
    expect(sub.citation).toBe("KCC 21A.09T.030");
  });

  it("home business is conditional, citing the RA home-occupation section", () => {
    const hb = find(z.answers, /home business/i);
    expect(hb.verdict).toBe("conditional");
    expect(hb.citation).toBe("KCC 21A.30.085");
  });

  it("reports verified dimensional standards (40 ft height, 5 ft interior)", () => {
    const height = z.standards.find((s) => /height/i.test(s.label));
    const interior = z.standards.find((s) => /interior/i.test(s.label));
    expect(height?.value).toBe("40 ft (base)");
    expect(interior?.value).toBe("5 ft");
    expect(z.standards.every((s) => s.citation === "KCC 21A.09T.030")).toBe(true);
  });
});

describe("analyzeZoning — lot-size-aware verdicts", () => {
  it("RA-5 with a large lot: ADU likely yes, subdivision conditional", () => {
    const z = analyzeZoning("RA-5", 10);
    expect(find(z.answers, /ADU/).verdict).toBe("likely yes"); // 10 >= 3.75
    expect(find(z.answers, /subdivide/i).verdict).toBe("conditional"); // 10 >= 2*3.75
  });

  it("subdivision is 'check with county' when acreage is unknown", () => {
    const z = analyzeZoning("RA-10", null);
    expect(find(z.answers, /subdivide/i).verdict).toBe("check with county");
  });

  it("flags overlay codes in notes without asserting their meaning", () => {
    const z = analyzeZoning("RA-2.5-SO", 5);
    expect(z.overlays).toContain("SO");
    expect(z.notes.some((n) => /overlay/i.test(n) && /SO/.test(n))).toBe(true);
  });
});

describe("analyzeZoning — unrecognized zones stay honest", () => {
  it("returns a single 'check with county' answer for non-RA zones", () => {
    const z = analyzeZoning("R-4", 0.2);
    expect(z.recognized).toBe(false);
    expect(z.answers).toHaveLength(1);
    expect(z.answers[0].verdict).toBe("check with county");
    expect(z.standards).toHaveLength(0);
  });
});
