import { describe, it, expect } from "vitest";
import { buildParcelMapView, lonToMercX, latToMercY } from "@/lib/map/static";

// A small square-ish ring near the real Vashon test parcel.
const RING: [number, number][] = [
  [-122.50621, 47.33167],
  [-122.50545, 47.33167],
  [-122.50545, 47.33219],
  [-122.50621, 47.33219],
  [-122.50621, 47.33167],
];

describe("buildParcelMapView", () => {
  it("returns null for a degenerate ring", () => {
    expect(buildParcelMapView(null)).toBeNull();
    expect(buildParcelMapView([])).toBeNull();
    expect(buildParcelMapView([[-122.5, 47.3], [-122.5, 47.3]])).toBeNull();
  });

  it("builds keyless KC primary + Esri fallback URLs over the same bbox", () => {
    const v = buildParcelMapView(RING)!;
    expect(v).not.toBeNull();
    expect(v.imageUrl).toContain("gismaps.kingcounty.gov");
    expect(v.imageUrl).toContain("KingCo_Aerial_");
    expect(v.fallbackUrl).toContain("services.arcgisonline.com");
    // Same bbox string on both so the SVG overlay aligns to either image.
    const bbox = (u: string) => new URL(u).searchParams.get("bbox");
    expect(bbox(v.imageUrl)).toBe(bbox(v.fallbackUrl));
    expect(new URL(v.imageUrl).searchParams.get("bboxSR")).toBe("3857");
  });

  it("projects the ring into pixel space within the image bounds", () => {
    const v = buildParcelMapView(RING, { width: 720, height: 480 })!;
    const pts = v.polygonPoints.split(" ").map((p) => p.split(",").map(Number));
    expect(pts).toHaveLength(RING.length);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(720);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(480);
    }
    // With 0.6 padding the parcel is centered, so vertices sit off the edges.
    const xs = pts.map((p) => p[0]);
    expect(Math.min(...xs)).toBeGreaterThan(50);
    expect(Math.max(...xs)).toBeLessThan(670);
  });

  it("mercator helpers are monotonic and sane", () => {
    expect(lonToMercX(0)).toBeCloseTo(0, 5);
    expect(lonToMercX(-122.5)).toBeLessThan(0);
    expect(latToMercY(47.33)).toBeGreaterThan(0);
    expect(latToMercY(47.34)).toBeGreaterThan(latToMercY(47.33)); // north → larger y
  });
});
