/**
 * U.S. Census neighborhood statistics for the parcel's tract.
 *
 * Step 1 — Census geocoder (KEYLESS, verified 2026-05-31): coords -> tract.
 * Step 2 — ACS 5-year data API: needs a free CENSUS_API_KEY (keyless access was
 * retired — requests without a key return "missing_key"). Built to the
 * documented ACS response format ([[headers],[values]]); verify live once a key
 * is configured. See /docs/data-sources.md.
 *
 * Privacy: these are aggregate TRACT statistics — no person-level data.
 */

const GEOCODER =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const ACS = "https://api.census.gov/data/2023/acs/acs5";

export interface NeighborhoodStats {
  tractName: string | null;
  population: number | null;
  medianHouseholdIncome: number | null;
  medianHomeValue: number | null;
  ownerOccupiedPct: number | null;
}

/** ACS uses large negative sentinels (e.g. -666666666) for "no data". */
function acsNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > -1e9 ? n : null;
}

async function geocodeTract(
  lat: number,
  lon: number,
): Promise<{ state: string; county: string; tract: string; name: string } | null> {
  const url = `${GEOCODER}?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Census geocoder HTTP ${res.status}`);
  const json = (await res.json()) as {
    result?: { geographies?: { "Census Tracts"?: Array<Record<string, string>> } };
  };
  const t = json.result?.geographies?.["Census Tracts"]?.[0];
  if (!t) return null;
  return { state: t.STATE, county: t.COUNTY, tract: t.TRACT, name: t.NAME };
}

export async function fetchNeighborhoodStats(
  lat: number,
  lon: number,
  apiKey: string,
): Promise<NeighborhoodStats | null> {
  const geo = await geocodeTract(lat, lon);
  if (!geo) return null;

  const vars = [
    "NAME",
    "B01003_001E", // population
    "B19013_001E", // median household income
    "B25077_001E", // median home value (owner-occupied)
    "B25003_001E", // occupied housing units
    "B25003_002E", // owner-occupied units
  ];
  const url =
    `${ACS}?get=${vars.join(",")}` +
    `&for=tract:${geo.tract}&in=state:${geo.state}%20county:${geo.county}` +
    `&key=${apiKey}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Census ACS HTTP ${res.status}`);
  const rows = (await res.json()) as string[][];
  // rows[0] = header, rows[1] = values.
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const header = rows[0];
  const values = rows[1];
  const get = (name: string) => values[header.indexOf(name)] ?? null;

  const occupied = acsNum(get("B25003_001E"));
  const owner = acsNum(get("B25003_002E"));

  return {
    tractName: get("NAME") ?? geo.name ?? null,
    population: acsNum(get("B01003_001E")),
    medianHouseholdIncome: acsNum(get("B19013_001E")),
    medianHomeValue: acsNum(get("B25077_001E")),
    ownerOccupiedPct:
      occupied && owner != null ? Math.round((owner / occupied) * 100) : null,
  };
}
