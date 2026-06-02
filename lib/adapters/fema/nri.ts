/**
 * FEMA National Risk Index (NRI) — natural-hazard risk at the parcel's census
 * tract. The NRI bundles 18 hazards into a composite score + rating + expected
 * annual loss, at census-tract granularity (current data v1.20, Dec 2025).
 *
 * Source (verified live 2026-06-02, keyless ArcGIS REST): the "National Risk
 * Index Census Tracts" Feature Service. Query by TRACTFIPS (the 11-digit GEOID
 * we already derive for the Neighborhood panel).
 *
 * Honesty: NRI is a RELATIVE, modeled national index — not a site engineering
 * assessment. We label it as such and link out to verify. No person-keyed data.
 */

const NRI_QUERY =
  "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query";

/** The 18 NRI hazards: field-prefix → display name. */
const HAZARDS: Record<string, string> = {
  AVLN: "Avalanche",
  CFLD: "Coastal flooding",
  CWAV: "Cold wave",
  DRGT: "Drought",
  ERQK: "Earthquake",
  HAIL: "Hail",
  HWAV: "Heat wave",
  HRCN: "Hurricane",
  ISTM: "Ice storm",
  LNDS: "Landslide",
  LTNG: "Lightning",
  RFLD: "Riverine flooding",
  SWND: "Strong wind",
  TRND: "Tornado",
  TSUN: "Tsunami",
  VLCN: "Volcanic activity",
  WFIR: "Wildfire",
  WNTW: "Winter weather",
};

/** Ratings that mean "worth surfacing" (drop very-low / no-rating noise). */
const NOTABLE = new Set(["Relatively Moderate", "Relatively High", "Very High"]);

export interface NriHazard {
  code: string;
  name: string;
  rating: string | null;
  score: number | null;
}

export interface SiteRisk {
  tractName: string | null;
  compositeScore: number | null;
  compositeRating: string | null;
  /** State percentile of the composite risk (0–100). */
  statePercentile: number | null;
  /** Expected annual loss, total dollars, for the tract. */
  ealTotal: number | null;
  /** Notable contributing hazards, most-significant first. */
  topHazards: NriHazard[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Pure normalizer (exported for tests): NRI attributes → SiteRisk. */
export function normalizeNri(a: Record<string, unknown>): SiteRisk {
  const hazards: NriHazard[] = Object.entries(HAZARDS)
    .map(([code, name]) => ({
      code,
      name,
      rating: str(a[`${code}_RISKR`]),
      score: num(a[`${code}_RISKS`]),
    }))
    .filter((h) => h.rating != null && NOTABLE.has(h.rating))
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0));

  return {
    tractName: str(a.TRACT) ?? str(a.TRACTFIPS),
    compositeScore: num(a.RISK_SCORE),
    compositeRating: str(a.RISK_RATNG),
    statePercentile: num(a.RISK_SPCTL),
    ealTotal: num(a.EAL_VALT),
    topHazards: hazards.slice(0, 5),
  };
}

/** Fetch NRI for a tract GEOID (11-digit TRACTFIPS). Null when not found. */
export async function getNriByTract(geoid: string): Promise<SiteRisk | null> {
  const params = new URLSearchParams({
    where: `TRACTFIPS='${geoid.replace(/'/g, "")}'`,
    outFields: "*",
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${NRI_QUERY}?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`FEMA NRI HTTP ${res.status}`);
  const json = (await res.json()) as {
    features?: Array<{ attributes: Record<string, unknown> }>;
  };
  const a = json.features?.[0]?.attributes;
  return a ? normalizeNri(a) : null;
}
