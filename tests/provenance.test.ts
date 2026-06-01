import { describe, it, expect } from "vitest";
import { computeFreshness, sourced, unavailable } from "@/lib/provenance";

const NOW = Date.parse("2026-05-31T12:00:00.000Z");
const HOUR = 3600;

describe("computeFreshness", () => {
  it("is 'unavailable' when there is no timestamp", () => {
    expect(computeFreshness(null, HOUR, NOW)).toBe("unavailable");
  });

  it("is 'unavailable' when the timestamp is unparseable", () => {
    expect(computeFreshness("not-a-date", HOUR, NOW)).toBe("unavailable");
  });

  it("is 'live' within the TTL window", () => {
    const fetchedAt = new Date(NOW - 30 * 60 * 1000).toISOString(); // 30 min ago
    expect(computeFreshness(fetchedAt, HOUR, NOW)).toBe("live");
  });

  it("is 'live' exactly at the TTL boundary", () => {
    const fetchedAt = new Date(NOW - HOUR * 1000).toISOString();
    expect(computeFreshness(fetchedAt, HOUR, NOW)).toBe("live");
  });

  it("is 'stale' past the TTL window", () => {
    const fetchedAt = new Date(NOW - 2 * HOUR * 1000).toISOString();
    expect(computeFreshness(fetchedAt, HOUR, NOW)).toBe("stale");
  });
});

describe("sourced", () => {
  it("marks a null value as unavailable regardless of TTL", () => {
    const sv = sourced<number>(null, {
      source: "Test",
      fetchedAt: new Date(NOW).toISOString(),
      ttlSeconds: HOUR,
      nowMs: NOW,
    });
    expect(sv.confidence).toBe("unavailable");
    expect(sv.value).toBeNull();
  });

  it("honors an explicit confirmed flag instead of TTL freshness", () => {
    const old = new Date(NOW - 10 * HOUR * 1000).toISOString();
    const sv = sourced(42, {
      source: "Test",
      fetchedAt: old,
      ttlSeconds: HOUR,
      confirmed: true,
      nowMs: NOW,
    });
    expect(sv.confidence).toBe("confirmed");
  });

  it("computes live/stale from the timestamp when not confirmed", () => {
    const fresh = new Date(NOW - 60 * 1000).toISOString();
    expect(
      sourced(1, { source: "T", fetchedAt: fresh, ttlSeconds: HOUR, nowMs: NOW })
        .confidence,
    ).toBe("live");
  });
});

describe("unavailable", () => {
  it("produces a null-valued, unavailable SourcedValue", () => {
    const sv = unavailable<string>("EPA Envirofacts");
    expect(sv).toEqual({
      value: null,
      source: "EPA Envirofacts",
      fetchedAt: null,
      confidence: "unavailable",
    });
  });
});
