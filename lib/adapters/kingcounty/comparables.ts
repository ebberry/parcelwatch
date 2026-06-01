import { KC_OPENDATA_BASE, queryLayer, escapeArcgisLiteral } from "./client";
import { polygonRingCentroid } from "@/lib/geo";

/**
 * Find nearby comparable parcels for assessment-uniformity evidence (the appeals
 * feature). A distance query returns same-use parcels with their assessed values.
 *
 * This is comparable-ASSESSMENT data, not sale prices (for real sales see
 * sales.ts). It supports the "uniformity" appeal argument (similar nearby homes
 * are assessed lower) and is never a modeled valuation.
 *
 * HOST FAILOVER: primary is the gisdata OpenDataPortal layer 1722; if that host
 * is down we fall back to the gismaps KingCo_PropertyInfo Parcels layer (2),
 * which carries the same fields and parcel geometry (lat/lon derived from the
 * polygon centroid). Verified live 2026-06-01 — see /docs/data-sources.md.
 */

const PARCEL_ADDRESS_QUERY = `${KC_OPENDATA_BASE}/property__parcel_address_area/MapServer/1722/query`;
const GISMAPS_PARCEL_QUERY =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query";

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

function toRawComparable(
  a: Partial<CompAttributes>,
  geometry: unknown,
): RawComparable {
  const land = a.APPRLNDVAL ?? 0;
  const impr = a.APPR_IMPR ?? 0;
  const c = a.LAT != null && a.LON != null ? { lat: a.LAT, lon: a.LON } : polygonRingCentroid(geometry);
  return {
    pin: a.PIN ?? "",
    address: a.ADDR_FULL?.replace(/\s+/g, " ").trim() || null,
    lotSqFt: a.LOTSQFT ?? null,
    assessedTotal: a.APPRLNDVAL != null && a.APPR_IMPR != null ? land + impr : null,
    lat: c?.lat ?? null,
    lon: c?.lon ?? null,
  };
}

export async function searchComparables(opts: {
  lat: number;
  lon: number;
  preuseCode: number;
  excludePin: string;
  radiusMeters?: number;
  limit?: number;
}): Promise<RawComparable[]> {
  const code = Math.trunc(opts.preuseCode);
  const excl = escapeArcgisLiteral(opts.excludePin);
  const point = { lat: opts.lat, lon: opts.lon };
  const distanceMeters = opts.radiusMeters ?? 1600;
  const resultRecordCount = opts.limit ?? 50;

  try {
    // Primary (gisdata): has LAT/LON columns and a PRIMARY_ADDR flag.
    const res = await queryLayer<CompAttributes>({
      queryUrl: PARCEL_ADDRESS_QUERY,
      where: `PREUSE_CODE=${code} AND PRIMARY_ADDR=1 AND APPR_IMPR>0 AND LOTSQFT>0 AND PIN<>'${excl}'`,
      outFields: "PIN,ADDR_FULL,LOTSQFT,APPRLNDVAL,APPR_IMPR,LAT,LON",
      returnGeometry: false,
      resultRecordCount,
      distanceMeters,
      point,
    });
    return (res.features ?? []).map((f) => toRawComparable(f.attributes, f.geometry));
  } catch {
    // Failover (gismaps): no LAT/LON or PRIMARY_ADDR — derive coords from
    // geometry and dedupe by PIN.
    const res = await queryLayer<Partial<CompAttributes>>({
      queryUrl: GISMAPS_PARCEL_QUERY,
      where: `PREUSE_CODE=${code} AND APPR_IMPR>0 AND LOTSQFT>0 AND PIN<>'${excl}'`,
      outFields: "PIN,ADDR_FULL,LOTSQFT,APPRLNDVAL,APPR_IMPR",
      returnGeometry: true,
      outSR: "4326",
      resultRecordCount,
      distanceMeters,
      point,
    });
    const byPin = new Map<string, RawComparable>();
    for (const f of res.features ?? []) {
      const row = toRawComparable(f.attributes, f.geometry);
      if (row.pin && !byPin.has(row.pin)) byPin.set(row.pin, row);
    }
    return [...byPin.values()];
  }
}
