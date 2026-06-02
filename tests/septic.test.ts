import { describe, it, expect } from "vitest";
import { normalizeTreatment } from "@/lib/adapters/kingcounty/septic";

describe("normalizeTreatment", () => {
  it("maps King County wastewater strings to a clean enum", () => {
    expect(normalizeTreatment("on-site sewage system")).toBe("septic");
    expect(normalizeTreatment("sewer connection")).toBe("sewer");
    expect(normalizeTreatment("vacant")).toBe("vacant");
    expect(normalizeTreatment("vacant\nvacant")).toBe("vacant"); // dirty source value
    expect(normalizeTreatment("all other values")).toBe("other");
    expect(normalizeTreatment(null)).toBe("unknown");
    expect(normalizeTreatment("")).toBe("unknown");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(normalizeTreatment("  On-Site Sewage System  ")).toBe("septic");
    expect(normalizeTreatment("SEWER CONNECTION")).toBe("sewer");
  });
});
