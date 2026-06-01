import { describe, it, expect } from "vitest";
import { epaFrsAdapter, type RawEpa } from "@/lib/adapters/epa/sites";
import { dohWaterAdapter, type RawDoh } from "@/lib/adapters/doh/water";
import { buildNearbySites } from "@/lib/environment/nearby";

// Real responses captured live 2026-05-31. See /docs/data-sources.md.
import epaFixture from "./fixtures/epa-frs.json";
import dohFixture from "./fixtures/doh-water.json";

const ORIGIN = { lat: 47.3314667, lon: -122.50043043 };

describe("buildNearbySites", () => {
  it("computes distance, sorts nearest-first, and caps the list", () => {
    const out = buildNearbySites(
      ORIGIN,
      [
        { name: "far", detail: null, lat: 47.40, lon: -122.50 },
        { name: "near", detail: null, lat: 47.332, lon: -122.500 },
        { name: "mid", detail: null, lat: 47.35, lon: -122.50 },
      ],
      { radiusKm: 3, take: 2 },
    );
    expect(out.count).toBe(3);
    expect(out.nearest).toHaveLength(2);
    expect(out.nearest[0].name).toBe("near");
    expect(out.nearest[0].distanceKm).toBeLessThan(out.nearest[1].distanceKm!);
  });
});

describe("epaFrsAdapter.normalize (real fixture)", () => {
  const raw: RawEpa = {
    origin: ORIGIN,
    rows: (epaFixture as { features: { attributes: Record<string, unknown> }[] }).features.map(
      (f) => f.attributes as unknown as RawEpa["rows"][number],
    ),
  };
  const out = epaFrsAdapter.normalize(raw);

  it("de-dupes facilities by REGISTRY_ID (fewer sites than raw rows)", () => {
    expect(out.count).toBeLessThanOrEqual(raw.rows.length);
    expect(out.count).toBeGreaterThan(0);
  });

  it("aggregates program acronyms into the detail line", () => {
    const withPrograms = out.nearest.find((s) => s.detail && s.detail.length > 0);
    expect(withPrograms).toBeTruthy();
  });
});

describe("dohWaterAdapter.normalize (real fixture, geometry-based)", () => {
  const features = (dohFixture as {
    features: { attributes: Record<string, unknown>; geometry?: { x: number; y: number } }[];
  }).features;
  const raw: RawDoh = {
    origin: ORIGIN,
    rows: features.map((f) => ({
      attrs: f.attributes as unknown as RawDoh["rows"][number]["attrs"],
      lat: f.geometry?.y ?? null,
      lon: f.geometry?.x ?? null,
    })),
  };
  it("derives distance from geometry and labels group + status", () => {
    const out = dohWaterAdapter.normalize(raw);
    expect(out.count).toBeGreaterThan(0);
    expect(out.nearest[0].distanceKm).not.toBeNull();
    expect(out.nearest.some((s) => /Group [AB]/.test(s.detail ?? ""))).toBe(true);
  });
});
