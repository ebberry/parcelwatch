import { describe, it, expect } from "vitest";
import { titleCaseAddress, titleCaseName } from "@/lib/format";

describe("titleCaseAddress", () => {
  it("proper-cases an ALL-CAPS address, keeping directionals", () => {
    expect(titleCaseAddress("12825 SW BACHELOR RD")).toBe("12825 SW Bachelor Rd");
    expect(titleCaseAddress("29012 125TH PL SW")).toBe("29012 125th Pl SW");
    expect(titleCaseAddress("VASHON")).toBe("Vashon");
  });

  it("passes through null/undefined", () => {
    expect(titleCaseAddress(null)).toBeNull();
    expect(titleCaseAddress(undefined)).toBeUndefined();
  });
});

describe("titleCaseName", () => {
  it("proper-cases names across hyphen and slash boundaries", () => {
    expect(titleCaseName("SUNNYSLOPE MUTUAL WATER SYSTEM")).toBe(
      "Sunnyslope Mutual Water System",
    );
    expect(titleCaseName("RICE/MEEKS WATER SYSTEM")).toBe("Rice/Meeks Water System");
    expect(titleCaseName("UDALL-TWING WATER")).toBe("Udall-Twing Water");
  });
});
