import { describe, it, expect } from "vitest";
import { decodePropertyType, GLOSSARY } from "@/lib/glossary";

describe("decodePropertyType", () => {
  it("decodes verified King County PROPTYPE codes", () => {
    expect(decodePropertyType("R")).toEqual({ code: "R", label: "Residential" });
    expect(decodePropertyType("K")?.label).toBe("Condominium");
    expect(decodePropertyType("C")?.label).toBe("Commercial");
  });

  it("uppercases and falls back gracefully for unknown codes", () => {
    expect(decodePropertyType("r")?.label).toBe("Residential");
    expect(decodePropertyType("Z")?.label).toBe("Other classification");
  });

  it("returns null for missing input (no invention)", () => {
    expect(decodePropertyType(null)).toBeNull();
  });
});

describe("GLOSSARY", () => {
  it("explains the property-type codes in its definition", () => {
    expect(GLOSSARY.propertyType).toMatch(/R = Residential/);
  });
});
