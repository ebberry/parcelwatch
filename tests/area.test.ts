import { describe, it, expect } from "vitest";
import { resolveArea } from "@/lib/watches/area";

describe("resolveArea", () => {
  it("maps Vashon to the unincorporated island area (county council only)", () => {
    const a = resolveArea({ city: "Vashon" });
    expect(a.key).toBe("kc-vashon");
    expect(a.councils.map((c) => c.client)).toEqual(["kingcounty"]);
    expect(a.description).toMatch(/Vashon/);
  });

  it("maps a Legistar city to city + county councils", () => {
    const a = resolveArea({ city: "SEATTLE" });
    expect(a.key).toBe("seattle");
    expect(a.councils.map((c) => c.client)).toEqual(["seattle", "kingcounty"]);
    expect(a.description).toMatch(/Seattle/);
    const b = resolveArea({ city: "Bellevue" });
    expect(b.councils.map((c) => c.client)).toEqual(["bellevue", "kingcounty"]);
  });

  it("falls back to unincorporated King County for unknown/empty cities", () => {
    for (const city of ["Enumclaw", "", null]) {
      const a = resolveArea({ city });
      expect(a.key).toBe("kc-unincorporated");
      expect(a.councils.map((c) => c.client)).toEqual(["kingcounty"]);
    }
  });

  it("is case-insensitive", () => {
    expect(resolveArea({ city: "seattle" }).key).toBe("seattle");
    expect(resolveArea({ city: "SeAtTlE" }).key).toBe("seattle");
  });
});
