import { describe, it, expect } from "vitest";
import { parseHazardHits } from "@/lib/adapters/kingcounty/sensitiveAreas";
import { summarizeFindings } from "@/lib/report/summary";

const NONE = {
  recommendation: null,
  flood: null,
  seismic: null,
  siteRisk: null,
  epa: null,
  councilCount: 0,
  tax: null,
};

describe("parseHazardHits", () => {
  it("maps hazard layers to distinct names and ignores non-hazard layers", () => {
    const out = parseHazardHits([
      { layerId: 1, layerName: "Potential landslide hazard areas (2016)" },
      { layerId: 4, layerName: "Potential steep slope hazard areas (2016)" },
      { layerId: 7, layerName: "Erosion hazard (1990 SAO)" },
      { layerId: 5, layerName: "Basin condition (2005 CAO)" }, // not a hazard → ignored
      { layerId: 3, layerName: "Landslide hazards, incorporated KC (1990)" }, // dedupes with 1
    ]);
    expect(out).toEqual(["Landslide hazard area", "Steep slope hazard", "Erosion hazard"]);
  });

  it("returns [] when no hazard layers match", () => {
    expect(parseHazardHits([{ layerId: 16, layerName: "Shoreline management designations" }])).toEqual([]);
  });
});

describe("critical-area finding", () => {
  it("surfaces a landslide hazard in the synthesis header", () => {
    const out = summarizeFindings({ ...NONE, criticalAreas: ["Landslide hazard area", "Erosion hazard"] });
    const f = out.find((x) => x.id === "geo");
    expect(f).toBeDefined();
    expect(f!.title).toMatch(/landslide hazard area/);
  });

  it("does not surface for non-landslide critical areas alone", () => {
    const out = summarizeFindings({ ...NONE, criticalAreas: ["Erosion hazard"] });
    expect(out.find((x) => x.id === "geo")).toBeUndefined();
  });
});
