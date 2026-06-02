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
 * SOURCE: gismaps KingCo_PropertyInfo Parcels layer (2) is PRIMARY (the old
 * gisdata layer 1722 was retired 2026-06-01). Lat/lon comes from the polygon
 * centroid; we dedupe by PIN. The retired gisdata layer is kept only as
 * insurance if it's resurrected. See /docs/data-sources.md.
 */

const GISMAPS_PARCEL_QUERY =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query";
const GISDATA_PARCEL_QUERY = `${KC_OPENDATA_BASE}/property__parcel_address_area/MapServer/1722/query`;

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

export interface ParcelValuation {
  assessedTotal: number | null;
  lotSqFt: number | null;
  address: string | null;
}

/**
 * Batch-fetch current assessed values (+ lot size) for a list of PINs, so each
 * comparable SALE can be shown alongside the county's assessment of that same
 * home (the assessment-to-sale "ratio study" the Board uses). Same gisdata →
 * gismaps failover. Returns a PIN→valuation map; missing PINs are simply absent.
 */
export async function getValuationsByPins(
  pins: string[],
): Promise<Map<string, ParcelValuation>> {
  const unique = [...new Set(pins.filter(Boolean))].slice(0, 100);
  const out = new Map<string, ParcelValuation>();
  if (!unique.length) return out;
  const inList = unique.map((p) => `'${escapeArcgisLiteral(p)}'`).join(",");

  const collect = (
    rows: { attributes: Partial<CompAttributes> & { PRIMARY_ADDR?: number | null } }[],
  ) => {
    for (const f of rows) {
      const r = toRawComparable(f.attributes, undefined);
      if (!r.pin) continue;
      const existing = out.get(r.pin);
      // Take the first row for a PIN; replace only to fill in a missing
      // assessment or to prefer the primary-address row.
      const better =
        !existing ||
        (existing.assessedTotal == null && r.assessedTotal != null) ||
        f.attributes.PRIMARY_ADDR === 1;
      if (better) {
        out.set(r.pin, {
          assessedTotal: r.assessedTotal,
          lotSqFt: r.lotSqFt,
          address: r.address,
        });
      }
    }
  };

  try {
    // PRIMARY: gismaps (no PRIMARY_ADDR column; dedup by PIN in collect()).
    const res = await queryLayer<Partial<CompAttributes>>({
      queryUrl: GISMAPS_PARCEL_QUERY,
      where: `PIN IN (${inList})`,
      outFields: "PIN,ADDR_FULL,LOTSQFT,APPRLNDVAL,APPR_IMPR",
      returnGeometry: false,
      resultRecordCount: 200,
    });
    collect(res.features ?? []);
  } catch {
    // Insurance: retired gisdata layer (has PRIMARY_ADDR) if it's resurrected.
    const res = await queryLayer<CompAttributes & { PRIMARY_ADDR: number | null }>({
      queryUrl: GISDATA_PARCEL_QUERY,
      where: `PIN IN (${inList})`,
      outFields: "PIN,ADDR_FULL,LOTSQFT,APPRLNDVAL,APPR_IMPR,PRIMARY_ADDR",
      returnGeometry: false,
      resultRecordCount: 200,
    });
    collect(res.features ?? []);
  }
  return out;
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
    // PRIMARY (gismaps): no LAT/LON or PRIMARY_ADDR — derive coords from the
    // polygon centroid and dedupe by PIN.
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
  } catch {
    // Insurance: retired gisdata layer (LAT/LON columns + PRIMARY_ADDR flag).
    const res = await queryLayer<CompAttributes>({
      queryUrl: GISDATA_PARCEL_QUERY,
      where: `PREUSE_CODE=${code} AND PRIMARY_ADDR=1 AND APPR_IMPR>0 AND LOTSQFT>0 AND PIN<>'${excl}'`,
      outFields: "PIN,ADDR_FULL,LOTSQFT,APPRLNDVAL,APPR_IMPR,LAT,LON",
      returnGeometry: false,
      resultRecordCount,
      distanceMeters,
      point,
    });
    return (res.features ?? []).map((f) => toRawComparable(f.attributes, f.geometry));
  }
}
