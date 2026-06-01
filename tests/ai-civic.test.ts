import { describe, it, expect } from "vitest";
import { extractJson, AiError } from "@/lib/ai/claude";
import {
  buildCivicUserPrompt,
  parseCivicInsights,
  itemContentHash,
  isRelevant,
  relevanceRank,
  type CivicInsight,
} from "@/lib/ai/civic";
import { resolveArea } from "@/lib/watches/area";
import type { WatchItem } from "@/lib/watches";

const AREA = resolveArea({ city: "VASHON" });

const item = (externalId: string, title: string, over: Partial<WatchItem> = {}): WatchItem => ({
  kind: "council",
  externalId,
  title,
  detail: "Ordinance · In Committee",
  fullText: null,
  source: "King County Council (Legistar)",
  url: "https://example.test",
  date: "2026-05-01",
  topics: ["shoreline"],
  ...over,
});

describe("extractJson", () => {
  it("parses fenced JSON with surrounding prose", () => {
    const text = 'Sure!\n```json\n[{"a":1}]\n```\nDone.';
    expect(extractJson<{ a: number }[]>(text)).toEqual([{ a: 1 }]);
  });
  it("parses a bare array", () => {
    expect(extractJson('[{"x":true}]')).toEqual([{ x: true }]);
  });
  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow(AiError);
  });
});

describe("buildCivicUserPrompt", () => {
  it("includes each item's id, title, and full text for grounding", () => {
    const prompt = buildCivicUserPrompt([
      item("kc-1", "2026-0123: Shoreline setbacks", { fullText: "AN ORDINANCE relating to shoreline setbacks countywide." }),
    ], AREA);
    expect(prompt).toMatch(/Vashon Island/);
    expect(prompt).toMatch(/externalId: kc-1/);
    expect(prompt).toMatch(/Shoreline setbacks/);
    expect(prompt).toMatch(/full text: AN ORDINANCE/);
  });
});

describe("parseCivicInsights", () => {
  const valid = new Set(["kc-1", "kc-2"]);

  it("keeps valid items and coerces fields", () => {
    const text = JSON.stringify([
      { externalId: "kc-1", relevance: "high", scope: "countywide", summary: "Does X.", whyItMatters: "Affects your setbacks." },
      { externalId: "kc-2", relevance: "none", scope: "site-specific", summary: "A mainland project.", whyItMatters: "irrelevant" },
    ]);
    const out = parseCivicInsights(text, valid);
    expect(out).toHaveLength(2);
    expect(out[0].whyItMatters).toBe("Affects your setbacks.");
    // whyItMatters is nulled when relevance is "none".
    expect(out[1].whyItMatters).toBeNull();
  });

  it("drops unknown ids and entries with no summary, and clamps bad enums", () => {
    const text = JSON.stringify([
      { externalId: "ghost", relevance: "high", scope: "countywide", summary: "x" },
      { externalId: "kc-1", relevance: "bogus", scope: "weird", summary: "Kept." },
      { externalId: "kc-2", relevance: "high", scope: "countywide", summary: "" },
    ]);
    const out = parseCivicInsights(text, valid);
    expect(out.map((o) => o.externalId)).toEqual(["kc-1"]);
    expect(out[0].relevance).toBe("low"); // clamped
    expect(out[0].scope).toBe("countywide"); // clamped
  });
});

describe("itemContentHash", () => {
  it("is stable for the same content and changes when content changes", () => {
    const a = item("kc-1", "Title A", { fullText: "body" });
    const b = item("kc-1", "Title A", { fullText: "body" });
    const c = item("kc-1", "Title A", { fullText: "different" });
    expect(itemContentHash(a)).toBe(itemContentHash(b));
    expect(itemContentHash(a)).not.toBe(itemContentHash(c));
  });
});

describe("relevance helpers", () => {
  const mk = (relevance: CivicInsight["relevance"]): CivicInsight => ({
    externalId: "x",
    relevance,
    scope: "countywide",
    summary: "s",
    whyItMatters: null,
  });
  it("treats high/medium as relevant, low/none as not", () => {
    expect(isRelevant(mk("high"))).toBe(true);
    expect(isRelevant(mk("medium"))).toBe(true);
    expect(isRelevant(mk("low"))).toBe(false);
    expect(isRelevant(mk("none"))).toBe(false);
    expect(isRelevant(undefined)).toBe(false);
  });
  it("ranks more-relevant first", () => {
    expect(relevanceRank("high")).toBeLessThan(relevanceRank("medium"));
    expect(relevanceRank("medium")).toBeLessThan(relevanceRank("none"));
  });
});
