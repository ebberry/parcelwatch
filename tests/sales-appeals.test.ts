import { describe, it, expect } from "vitest";
import { buildSaleCompSet } from "@/lib/sales/service";
import {
  buildMarketValueNarrative,
  buildRecentPurchaseNarrative,
  buildAppealNarrative,
  buildRecommendation,
  buildRequestSentence,
} from "@/lib/appeals";
import type { ParcelCore } from "@/lib/adapters/kingcounty/parcel";
import type { RawSale } from "@/lib/adapters/kingcounty/sales";
import type { ParcelValuation } from "@/lib/adapters/kingcounty/comparables";

function subject(overrides: Partial<ParcelCore> = {}): ParcelCore {
  return {
    pin: "0000000001",
    address: "1 SUBJECT ST",
    city: "VASHON",
    zip: "98070",
    lat: 47.331,
    lon: -122.5,
    lotSqFt: 44066,
    acres: 1.01,
    zoningCode: "RA-2.5",
    presentUseCode: 2,
    presentUse: "Single Family(Res Use/Zone)",
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

const sale = (
  pin: string,
  salePrice: number,
  saleDate: string,
  over: Partial<RawSale> = {},
): RawSale => ({
  pin,
  address: `${pin} SALE RD`,
  saleDate,
  salePrice,
  propertyType: "NA",
  principalUse: "RESIDENTIAL",
  propertyClass: "Res-Improved property",
  improved: true,
  lat: 47.3315,
  lon: -122.5005,
  ...over,
});

const vals = (
  entries: [string, number | null][],
): Map<string, ParcelValuation> =>
  new Map(
    entries.map(([pin, assessedTotal]) => [
      pin,
      { assessedTotal, lotSqFt: null, address: null },
    ]),
  );

describe("buildSaleCompSet", () => {
  it("flags appearsHigh when assessed exceeds the comparable-sale median", () => {
    const set = buildSaleCompSet(subject(), [
      sale("a", 700000, "2025-08-13"),
      sale("b", 720000, "2025-06-10"),
      sale("c", 680000, "2024-11-02"),
    ]);
    expect(set.comps).toHaveLength(3);
    expect(set.medianSalePrice).toBe(700000);
    expect(set.assessedVsMedianSalePct).toBeGreaterThan(40);
    expect(set.appearsHigh).toBe(true);
    expect(set.earliestSale).toBe("2024-11-02");
    expect(set.latestSale).toBe("2025-08-13");
  });

  it("joins each comp's assessed value and computes the assessment-to-sale ratio", () => {
    const set = buildSaleCompSet(
      subject(),
      [
        sale("a", 700000, "2025-08-13"),
        sale("b", 800000, "2025-06-10"),
        sale("c", 600000, "2024-11-02"),
      ],
      [],
      vals([
        ["a", 630000], // 90% of sale
        ["b", 640000], // 80% of sale
        ["c", 600000], // 100% of sale
      ]),
    );
    expect(set.comps.map((c) => c.assessedTotal)).toEqual([630000, 640000, 600000]);
    expect(set.comps.map((c) => c.assessedToSalePct)).toEqual([90, 80, 100]);
    expect(set.medianAssessedTotal).toBe(630000);
    expect(set.medianAssessedToSalePct).toBe(90);
  });

  it("leaves assessed columns null when no valuations are supplied", () => {
    const set = buildSaleCompSet(subject(), [sale("a", 700000, "2025-08-13")]);
    expect(set.comps[0].assessedTotal).toBeNull();
    expect(set.comps[0].assessedToSalePct).toBeNull();
    expect(set.medianAssessedTotal).toBeNull();
  });

  it("does not flag a subject in line with comparable sales", () => {
    const set = buildSaleCompSet(subject(), [
      sale("a", 1050000, "2025-08-13"),
      sale("b", 1100000, "2025-06-10"),
      sale("c", 1020000, "2024-11-02"),
    ]);
    expect(set.appearsHigh).toBe(false);
  });

  it("drops non-residential sales for a residential subject", () => {
    const set = buildSaleCompSet(subject(), [
      sale("res", 700000, "2025-08-13"),
      sale("comm", 650000, "2025-07-01", { principalUse: "COMMERCIAL" }),
    ]);
    expect(set.comps.map((c) => c.pin)).toEqual(["res"]);
  });

  it("derives the subject's recent purchase from its own sale history", () => {
    const set = buildSaleCompSet(
      subject(),
      [sale("a", 700000, "2025-08-13")],
      [
        sale("0000000001", 820000, "2024-09-15"),
        sale("0000000001", 500000, "2015-03-01"),
      ],
    );
    expect(set.subjectSale?.salePrice).toBe(820000);
    expect(set.subjectSale?.saleDate).toBe("2024-09-15");
    // (1072000 - 820000) / 1072000 ≈ 24%
    expect(set.subjectSale?.belowAssessedPct).toBe(24);
  });

  it("ignores sales with missing price or date", () => {
    const set = buildSaleCompSet(subject(), [
      sale("ok", 700000, "2025-08-13"),
      sale("noprice", 0, "2025-01-01", { salePrice: null }),
      sale("nodate", 690000, "2025-01-01", { saleDate: null }),
    ]);
    expect(set.comps.map((c) => c.pin)).toEqual(["ok"]);
  });
});

describe("sales narratives", () => {
  it("writes a market-value paragraph only when assessed appears high", () => {
    const high = buildSaleCompSet(subject(), [
      sale("a", 700000, "2025-08-13"),
      sale("b", 720000, "2025-06-10"),
      sale("c", 680000, "2024-11-02"),
    ]);
    const text = buildMarketValueNarrative(high);
    expect(text).toMatch(/true and fair market value/);
    expect(text).toMatch(/RCW 84\.40\.0301/);

    const inline = buildSaleCompSet(subject(), [
      sale("a", 1050000, "2025-08-13"),
      sale("b", 1100000, "2025-06-10"),
    ]);
    expect(buildMarketValueNarrative(inline)).toBeNull();
  });

  it("writes a recent-purchase paragraph when the owner bought below assessed", () => {
    const set = buildSaleCompSet(
      subject(),
      [sale("a", 700000, "2025-08-13")],
      [sale("0000000001", 820000, "2024-09-15")],
    );
    const text = buildRecentPurchaseNarrative(set);
    expect(text).toMatch(/last sold in September 2024/);
    expect(text).toMatch(/\$820,000/);
  });

  it("assembles a combined narrative with the implied reason checkboxes", () => {
    const set = buildSaleCompSet(
      subject(),
      [
        sale("a", 700000, "2025-08-13"),
        sale("b", 720000, "2025-06-10"),
        sale("c", 680000, "2024-11-02"),
      ],
      [sale("0000000001", 820000, "2024-09-15")],
    );
    const { text, reasons } = buildAppealNarrative({ comp: null, sale: set });
    expect(reasons).toContain("market");
    expect(reasons).toContain("purchase");
    expect(text).toMatch(/last sold/);
    expect(text).toMatch(/comparable properties/);
  });

  it("produces no narrative and no reasons when nothing supports an appeal", () => {
    const inline = buildSaleCompSet(subject(), [
      sale("a", 1050000, "2025-08-13"),
      sale("b", 1100000, "2025-06-10"),
    ]);
    const { text, reasons } = buildAppealNarrative({ comp: null, sale: inline });
    expect(text).toBeNull();
    expect(reasons).toEqual([]);
  });
});

describe("buildRecommendation", () => {
  const assessed = 1072000;

  it("anchors on the owner's recent purchase and rates it a strong case", () => {
    const set = buildSaleCompSet(
      subject(),
      [sale("a", 950000, "2025-08-13"), sale("b", 980000, "2025-06-10")],
      [sale("0000000001", 820000, "2024-09-15")],
    );
    const rec = buildRecommendation({ assessedTotal: assessed, sale: set, comp: null });
    expect(rec.shouldAppeal).toBe(true);
    expect(rec.recommendedValue).toBe(820000);
    expect(rec.reductionPct).toBe(24);
    expect(rec.strength).toBe("strong");
    expect(rec.basis).toMatch(/purchase price/);
    // Both a purchase and a sales indicator are surfaced for transparency.
    expect(rec.indicators.map((i) => i.key)).toContain("purchase");
    expect(rec.indicators.map((i) => i.key)).toContain("sales");
  });

  it("falls back to the comparable-sales median when there's no recent purchase", () => {
    const set = buildSaleCompSet(subject(), [
      sale("a", 700000, "2025-08-13"),
      sale("b", 720000, "2025-06-10"),
      sale("c", 680000, "2024-11-02"),
    ]);
    const rec = buildRecommendation({ assessedTotal: assessed, sale: set, comp: null });
    expect(rec.shouldAppeal).toBe(true);
    expect(rec.recommendedValue).toBe(700000);
    expect(rec.basis).toMatch(/comparable sale/);
  });

  it("does not recommend an appeal when assessed is in line with the evidence", () => {
    const set = buildSaleCompSet(subject(), [
      sale("a", 1050000, "2025-08-13"),
      sale("b", 1100000, "2025-06-10"),
    ]);
    const rec = buildRecommendation({ assessedTotal: assessed, sale: set, comp: null });
    expect(rec.shouldAppeal).toBe(false);
    expect(rec.strength).toBe("none");
  });

  // In production the assessed total passed to buildRecommendation is the SAME
  // p.assessment.appraisedTotal that buildSaleCompSet uses, so the subject ratio
  // is internally consistent. These helpers mirror that.
  const subjectAssessed = (total: number): ParcelCore => {
    const s = subject();
    return { ...s, assessment: { ...s.assessment!, appraisedTotal: total } };
  };

  it("recommends an equity appeal when the ratio is worse than neighbors, even though assessed < sale price", () => {
    // Subject assessed $760k, sold $900k (84% ratio). Neighbors assessed ~70%.
    const subj = subjectAssessed(760000);
    const set = buildSaleCompSet(
      subj,
      [
        sale("a", 1000000, "2025-08-13"),
        sale("b", 1000000, "2025-06-10"),
        sale("c", 1000000, "2024-11-02"),
      ],
      [sale("0000000001", 900000, "2025-05-01")],
      vals([
        ["a", 700000], // 70%
        ["b", 700000], // 70%
        ["c", 700000], // 70%
      ]),
    );
    expect(set.subjectAssessedToSalePct).toBe(84);
    expect(set.medianAssessedToSalePct).toBe(70);
    // No value case: assessed $760k is below every sale price.
    const rec = buildRecommendation({ assessedTotal: 760000, sale: set, comp: null });
    expect(rec.shouldAppeal).toBe(true);
    expect(rec.indicators.find((i) => i.key === "equity")).toBeDefined();
    // 70% of the $900k sale ≈ $630k — the equitable target, below assessed.
    expect(rec.recommendedValue).toBe(630000);
    expect(rec.basis).toMatch(/neighborhood assessment ratio/);
    // Pure equity/ratio case tops out at "moderate" (17% reduction → moderate).
    expect(rec.strength).toBe("moderate");

    const text = buildAppealNarrative({ comp: null, sale: set }).text ?? "";
    expect(text).toMatch(/assessed below its recent sale price/);
    expect(text).toMatch(/uniform and equitable/);
  });

  it("does not assert an equity case when the subject ratio matches neighbors", () => {
    // Subject assessed $680k, sold $1,000k → 68% ratio; peers also 68%.
    const subj = subjectAssessed(680000);
    const set = buildSaleCompSet(
      subj,
      [sale("a", 1000000, "2025-08-13"), sale("b", 1000000, "2025-06-10")],
      [sale("0000000001", 1000000, "2025-05-01")],
      vals([
        ["a", 680000], // 68%
        ["b", 680000], // 68%
      ]),
    );
    expect(set.subjectAssessedToSalePct).toBe(68);
    expect(set.medianAssessedToSalePct).toBe(68);
    const rec = buildRecommendation({ assessedTotal: 680000, sale: set, comp: null });
    expect(rec.indicators.find((i) => i.key === "equity")).toBeUndefined();
    expect(rec.shouldAppeal).toBe(false);
  });

  it("writes a first-person request sentence only when an appeal is recommended", () => {
    const set = buildSaleCompSet(
      subject(),
      [sale("a", 950000, "2025-08-13")],
      [sale("0000000001", 820000, "2024-09-15")],
    );
    const rec = buildRecommendation({ assessedTotal: assessed, sale: set, comp: null });
    const sentence = buildRequestSentence(rec);
    expect(sentence).toMatch(/reduced from \$1,072,000 to approximately \$820,000/);

    const inline = buildSaleCompSet(subject(), [sale("a", 1100000, "2025-08-13")]);
    const recNo = buildRecommendation({ assessedTotal: assessed, sale: inline, comp: null });
    expect(buildRequestSentence(recNo)).toBeNull();
  });
});
