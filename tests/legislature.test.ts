import { describe, it, expect } from "vitest";
import {
  normalizeLegislature,
  sinceDate,
  type WaLegBill,
} from "@/lib/watches/sources/legislature";

// Synthetic bills — descriptions are crafted to contain our exact keyword
// phrases. The real SB 5770 ("Primary residence/tax") doesn't contain phrases
// like "property tax" or "assessment" that our TOPICS keyword list requires.

const propTaxBill: WaLegBill = {
  billId: "SB 5770",
  billNumber: "5770",
  biennium: "2025-26",
  shortDescription: "Property tax levy",
  longDescription: "Modifying the property tax assessment levy for residential parcels.",
  currentStatus: "H Finance",
};

const aduBill: WaLegBill = {
  billId: "HB 1234",
  billNumber: "1234",
  biennium: "2025-26",
  shortDescription: "Accessory dwelling units",
  longDescription: "Expanding accessory dwelling unit allowances for residential zones statewide.",
  currentStatus: "House Rules",
};

const unrelatedBill: WaLegBill = {
  billId: "HB 9999",
  billNumber: "9999",
  biennium: "2025-26",
  shortDescription: "Vehicle safety standards",
  longDescription: "Concerning motor vehicle equipment requirements for commercial vehicles.",
  currentStatus: "House Transportation",
};

describe("normalizeLegislature", () => {
  it("keeps only topic-matching bills", () => {
    const out = normalizeLegislature([propTaxBill, aduBill, unrelatedBill]);
    expect(out).toHaveLength(2);
    const ids = out.map((x) => x.externalId);
    expect(ids).toContain("wa-leg-2025-26-SB-5770");
    expect(ids).toContain("wa-leg-2025-26-HB-1234");
    expect(ids).not.toContain("wa-leg-2025-26-HB-9999");
  });

  it("tags property-tax bill correctly and links to WA Leg bill summary", () => {
    const [item] = normalizeLegislature([propTaxBill]);
    expect(item.topics).toContain("property-tax");
    expect(item.title).toContain("SB 5770");
    expect(item.url).toContain("BillNumber=5770");
    expect(item.kind).toBe("legislature");
  });

  it("tags ADU bill correctly", () => {
    const [item] = normalizeLegislature([aduBill]);
    expect(item.topics).toContain("adu");
  });

  it("matches on longDescription when shortDescription is unrelated", () => {
    const bill: WaLegBill = {
      ...unrelatedBill,
      shortDescription: "Roads",
      longDescription: "A bill relating to septic system inspection requirements.",
    };
    const out = normalizeLegislature([bill]);
    expect(out).toHaveLength(1);
    expect(out[0].topics).toContain("septic");
  });

  it("returns empty when session is out (no bills)", () => {
    expect(normalizeLegislature([])).toHaveLength(0);
  });
});

describe("sinceDate", () => {
  it("returns a date 14 days before the given timestamp", () => {
    const ms = Date.parse("2026-06-01T00:00:00Z");
    expect(sinceDate(ms)).toBe("2026-05-18");
  });
});
