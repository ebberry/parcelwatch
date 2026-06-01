import { describe, it, expect } from "vitest";
import {
  kingCountyParcelAdapter,
  sanitizeAddressTerm,
  escapeArcgisLiteral,
  cleanText,
  PIN_RE,
  type RawParcelAttributes,
} from "@/lib/adapters/kingcounty";

// Real responses captured live from King County layer 1722 on 2026-05-31.
// See /docs/data-sources.md. These guard the normalizer against the messy
// shapes the live service actually returns (padding, nulls, leading zeros).
import detailFixture from "./fixtures/kingcounty-parcel-by-pin.json";
import searchFixture from "./fixtures/kingcounty-parcel-search.json";

const detailAttrs = (
  detailFixture as { features: { attributes: RawParcelAttributes }[] }
).features[0].attributes;

describe("kingCountyParcelAdapter.normalize (real fixture)", () => {
  const core = kingCountyParcelAdapter.normalize(detailAttrs);

  it("keeps the PIN as a string with leading zeros", () => {
    expect(core.pin).toBe("0121029008");
  });

  it("maps address and uses POSTALCTYNAME for city", () => {
    expect(core.address).toBe("12825 SW BACHELOR RD");
    expect(core.city).toBe("VASHON");
    expect(core.zip).toBe("98070");
  });

  it("trims fixed-width padding from present use", () => {
    // Raw value has ~23 trailing spaces in the fixture.
    expect(detailAttrs.PREUSE_DESC).toMatch(/\s{2,}$/);
    expect(core.presentUse).toBe("Single Family(Res Use/Zone)");
  });

  it("collapses internal whitespace runs in the legal description", () => {
    expect(core.legalDescription).not.toMatch(/\s{2,}/);
    expect(core.legalDescription?.startsWith("POR OF LOT 46 VASHON ISLAND")).toBe(
      true,
    );
  });

  it("carries lot size, acreage, and zoning as typed values", () => {
    expect(core.lotSqFt).toBe(44066);
    expect(core.acres).toBeCloseTo(1.0116, 3);
    expect(core.zoningCode).toBe("RA-2.5");
    expect(core.presentUseCode).toBe(2);
  });

  it("preserves coordinates", () => {
    expect(core.lat).toBeCloseTo(47.3314667, 5);
    expect(core.lon).toBeCloseTo(-122.50043043, 5);
  });

  it("never surfaces an owner-name field (privacy)", () => {
    // The normalized shape has no owner key at all.
    expect(Object.keys(core)).not.toContain("owner");
    expect(JSON.stringify(core).toLowerCase()).not.toContain("owner");
  });
});

describe("normalize edge cases", () => {
  it("maps null/missing fields to null, never invents values", () => {
    const sparse: RawParcelAttributes = {
      PIN: "1234567890",
      MAJOR: null,
      MINOR: null,
      ADDR_FULL: null,
      POSTALCTYNAME: null,
      CTYNAME: null,
      ZIP5: null,
      LAT: null,
      LON: null,
      LOTSQFT: null,
      KCA_ACRES: null,
      KCA_ZONING: null,
      PREUSE_CODE: null,
      PREUSE_DESC: null,
      PROPTYPE: null,
      LEGALDESC: null,
      PRIMARY_ADDR: null,
    };
    const core = kingCountyParcelAdapter.normalize(sparse);
    expect(core.address).toBeNull();
    expect(core.city).toBeNull();
    expect(core.lotSqFt).toBeNull();
    expect(core.zoningCode).toBeNull();
  });

  it("falls back to CTYNAME when POSTALCTYNAME is missing", () => {
    const base: RawParcelAttributes = {
      PIN: "1234567890",
      MAJOR: null,
      MINOR: null,
      ADDR_FULL: "1 MAIN ST",
      POSTALCTYNAME: null,
      CTYNAME: "SEATTLE",
      ZIP5: null,
      LAT: null,
      LON: null,
      LOTSQFT: null,
      KCA_ACRES: null,
      KCA_ZONING: null,
      PREUSE_CODE: null,
      PREUSE_DESC: null,
      PROPTYPE: null,
      LEGALDESC: null,
      PRIMARY_ADDR: null,
    };
    expect(kingCountyParcelAdapter.normalize(base).city).toBe("SEATTLE");
  });
});

describe("search fixture sanity", () => {
  it("returns multiple Bachelor Rd candidates, all with PINs", () => {
    const feats = (searchFixture as { features: { attributes: { PIN: string } }[] })
      .features;
    expect(feats.length).toBeGreaterThan(1);
    for (const f of feats) {
      expect(f.attributes.PIN).toMatch(/^\d{10}$/);
    }
  });
});

describe("input safety", () => {
  it("PIN_RE accepts 10 digits and rejects junk", () => {
    expect(PIN_RE.test("0121029008")).toBe(true);
    expect(PIN_RE.test("12345")).toBe(false);
    expect(PIN_RE.test("0121029008; DROP")).toBe(false);
  });

  it("escapes single quotes for the where clause", () => {
    expect(escapeArcgisLiteral("O'BRIEN")).toBe("O''BRIEN");
  });

  it("sanitizes address terms: uppercase, strips control chars, caps length", () => {
    expect(sanitizeAddressTerm("  12825 sw bachelor rd  ")).toBe(
      "12825 SW BACHELOR RD",
    );
    // SQL-ish injection characters are stripped to spaces.
    expect(sanitizeAddressTerm("main; drop table")).not.toContain(";");
    expect(sanitizeAddressTerm("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it("cleanText collapses and trims, nulls empties", () => {
    expect(cleanText("  a   b  ")).toBe("a b");
    expect(cleanText("   ")).toBeNull();
    expect(cleanText(null)).toBeNull();
  });
});
