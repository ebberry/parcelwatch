import { describe, it, expect } from "vitest";
import { femaFloodAdapter, type RawFloodAttributes } from "@/lib/adapters/fema";
import { usgsEarthquakeAdapter } from "@/lib/adapters/usgs";
import { haversineKm } from "@/lib/geo";

// Real responses captured live 2026-05-31. See /docs/data-sources.md.
import floodX from "./fixtures/fema-flood-x.json";
import floodVE from "./fixtures/fema-flood-ve.json";
import usgs from "./fixtures/usgs-earthquakes.json";

const attrs = (f: unknown) =>
  (f as { features: { attributes: RawFloodAttributes }[] }).features[0].attributes;

describe("femaFloodAdapter.normalize", () => {
  it("inland Zone X: minimal hazard, not in SFHA, sentinel BFE -> null", () => {
    const h = femaFloodAdapter.normalize(attrs(floodX));
    expect(h.mapped).toBe(true);
    expect(h.floodZone).toBe("X");
    expect(h.inSFHA).toBe(false);
    expect(h.baseFloodElevationFt).toBeNull(); // STATIC_BFE was -9999
    expect(h.firmId).toBe("53033C");
  });

  it("shoreline Zone VE: high-risk SFHA with a real base flood elevation", () => {
    const h = femaFloodAdapter.normalize(attrs(floodVE));
    expect(h.floodZone).toBe("VE");
    expect(h.inSFHA).toBe(true);
    expect(h.baseFloodElevationFt).toBe(15);
  });

  it("no polygon at the point -> mapped:false, nothing invented", () => {
    const h = femaFloodAdapter.normalize(null);
    expect(h).toEqual({
      mapped: false,
      floodZone: null,
      zoneSubtype: null,
      inSFHA: null,
      baseFloodElevationFt: null,
      firmId: null,
    });
  });
});

describe("usgsEarthquakeAdapter.normalize", () => {
  const origin = { lat: 47.3314667, lon: -122.50043043 };
  const result = usgsEarthquakeAdapter.normalize({ origin, response: usgs });

  it("counts all features and tags the window/radius from config", () => {
    expect(result.count).toBe(usgs.features.length);
    expect(result.radiusMi).toBe(62); // 100 km ≈ 62 miles
    expect(result.minMagnitude).toBe(2.5);
  });

  it("picks the strongest quake as 'largest'", () => {
    const maxMag = Math.max(...usgs.features.map((f) => f.properties.mag));
    expect(result.largest?.magnitude).toBe(maxMag);
  });

  it("orders 'recent' newest-first and caps at 5", () => {
    expect(result.recent.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < result.recent.length; i++) {
      expect(
        (result.recent[i - 1].time ?? "") >= (result.recent[i].time ?? ""),
      ).toBe(true);
    }
  });

  it("computes a plausible distance in miles from the parcel for each quake", () => {
    for (const q of result.recent) {
      expect(q.distanceMi).not.toBeNull();
      expect(q.distanceMi!).toBeGreaterThanOrEqual(0);
      expect(q.distanceMi!).toBeLessThanOrEqual(80); // 100 km ≈ 62 miles + rounding
    }
  });
});

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm(47.6, -122.3, 47.6, -122.3)).toBe(0);
  });

  it("approximates Seattle→Portland (~233 km)", () => {
    const d = haversineKm(47.6062, -122.3321, 45.5152, -122.6784);
    expect(d).toBeGreaterThan(225);
    expect(d).toBeLessThan(240);
  });
});
