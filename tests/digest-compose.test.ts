import { describe, it, expect } from "vitest";
import { composeDigest, type DigestInput } from "@/lib/digest/compose";

const base: DigestInput = {
  periodLabel: "this month",
  properties: [{ parcelId: "0221029065", address: "13215 SW Tahlequah Rd", city: "Vashon" }],
  alerts: [],
  dashboardUrl: "https://parcelwatch.ebberry.com/dashboard",
  unsubscribeUrl: "https://parcelwatch.ebberry.com/digest/unsubscribe?u=1&t=abc",
};

describe("composeDigest", () => {
  it("all-quiet month: reassuring, not silent", () => {
    const d = composeDigest(base);
    expect(d.subject).toMatch(/all quiet around 13215 SW Tahlequah Rd this month/);
    expect(d.text).toMatch(/Nothing needed your attention/);
    expect(d.html).toMatch(/Nothing needed your attention/);
    // Always carries the dashboard + unsubscribe links. (HTML escapes & → &amp;.)
    expect(d.text).toContain(base.dashboardUrl);
    expect(d.text).toContain(base.unsubscribeUrl);
    expect(d.html).toContain("/digest/unsubscribe?u=1&amp;t=abc");
  });

  it("with updates: counts them in the subject and lists each", () => {
    const d = composeDigest({
      ...base,
      alerts: [
        { kind: "council", title: "Ordinance 2026-12 on rural setbacks", detail: "Introduced May 30", url: "https://kingcounty.gov/x", source: "King County Council" },
        { kind: "legislature", title: "HB 1234 — shoreline permits", detail: null, url: null, source: "WA Legislature" },
      ],
    });
    expect(d.subject).toMatch(/2 updates around 13215 SW Tahlequah Rd this month/);
    expect(d.text).toContain("Ordinance 2026-12 on rural setbacks");
    expect(d.text).toContain("HB 1234 — shoreline permits");
    expect(d.html).toContain("County council");
    expect(d.html).toContain("State legislature");
    // Links render when present.
    expect(d.html).toContain('href="https://kingcounty.gov/x"');
  });

  it("singular vs plural in the subject", () => {
    const one = composeDigest({ ...base, alerts: [{ kind: "council", title: "X", detail: null, url: null, source: "S" }] });
    expect(one.subject).toMatch(/1 update around/);
  });

  it("multiple properties collapse in the subject", () => {
    const d = composeDigest({
      ...base,
      properties: [
        { parcelId: "1", address: "A St", city: "Vashon" },
        { parcelId: "2", address: "B St", city: "Vashon" },
      ],
    });
    expect(d.subject).toMatch(/around your 2 properties/);
  });

  it("escapes HTML in untrusted fields (no injection)", () => {
    const d = composeDigest({
      ...base,
      alerts: [{ kind: "council", title: '<script>alert(1)</script>', detail: 'a & b < c', url: null, source: "S" }],
    });
    expect(d.html).not.toContain("<script>alert(1)</script>");
    expect(d.html).toContain("&lt;script&gt;");
    expect(d.html).toContain("a &amp; b &lt; c");
  });
});
