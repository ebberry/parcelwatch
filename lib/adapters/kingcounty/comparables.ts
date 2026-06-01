import { KC_OPENDATA_BASE, queryLayer, escapeArcgisLiteral } from "./client";

/**
 * Find nearby comparable parcels for assessment-uniformity evidence (the appeals
 * feature). A single distance query against layer 1722 returns same-use parcels
 * with their assessed values — verified 2026-05-31, see /docs/data-sources.md.
 *
 * This is comparable-ASSESSMENT data, not sale prices (King County has no clean
 * live sales API). It supports the legitimate "uniformity" appeal argument
 * (similar nearby homes are assessed lower) and is never a modeled valuation.
 */

const PARCEL_ADDRESS_QUERY = `${KC_OPENDATA_BASE}/property__parcel_address_area/MapServer/1722/query`;

export interface RawComparable {
  pin: string;
  address: string | null;
  lotSqFt: number | null;
  assessedTotal: number | null;
  lat: number | null;
  lon: number | null;
}

interface CompAttributes {
  PIN: string;
  ADDR_FULL: string | null;
  LOTSQFT: number | null;
  APPRLNDVAL: number | null;
  APPR_IMPR: number | null;
  LAT: number | null;
  LON: number | null;
}

export async function searchComparables(opts: {
  lat: number;
  lon: number;
  preuseCode: number;
  excludePin: string;
  radiusMeters?: number;
  limit?: number;
}): Promise<RawComparable[]> {
  const res = await queryLayer<CompAttributes>({
    queryUrl: PARCEL_ADDRESS_QUERY,
    where: `PREUSE_CODE=${Math.trunc(opts.preuseCode)} AND PRIMARY_ADDR=1 AND APPR_IMPR>0 AND LOTSQFT>0 AND PIN<>'${escapeArcgisLiteral(opts.excludePin)}'`,
    outFields: "PIN,ADDR_FULL,LOTSQFT,APPRLNDVAL,APPR_IMPR,LAT,LON",
    returnGeometry: false,
    resultRecordCount: opts.limit ?? 50,
    // Distance buffer is passed via the query URL builder's extra params below.
    distanceMeters: opts.radiusMeters ?? 1600,
    point: { lat: opts.lat, lon: opts.lon },
  });

  return (res.features ?? []).map((f) => {
    const a = f.attributes;
    const land = a.APPRLNDVAL ?? 0;
    const impr = a.APPR_IMPR ?? 0;
    return {
      pin: a.PIN,
      address: a.ADDR_FULL?.replace(/\s+/g, " ").trim() || null,
      lotSqFt: a.LOTSQFT ?? null,
      assessedTotal: a.APPRLNDVAL != null && a.APPR_IMPR != null ? land + impr : null,
      lat: a.LAT ?? null,
      lon: a.LON ?? null,
    };
  });
}
