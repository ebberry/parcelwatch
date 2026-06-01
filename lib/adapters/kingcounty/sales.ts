import { queryLayer, escapeArcgisLiteral, ArcgisError } from "./client";
import { polygonRingCentroid } from "@/lib/geo";

/**
 * King County recent-sales adapter — the market-value evidence for the appeals
 * feature. Queries the "Property sales in the last 3 years" layer (3) on the
 * KingCo_PropertyInfo service: real recorded arm's-length sales with price, date,
 * use, and parcel geometry.
 *
 * This is RECORDED SALE data (excise-tax records), not a modeled valuation. It
 * supports the strongest WA appeal argument — that the assessed value exceeds
 * true and fair market value (RCW 84.40.0301) — using actual nearby sales.
 *
 * HOST FAILOVER: same pattern as the parcel adapter. We try the gisdata host
 * first, then the older gismaps host; both serve the identical layer. Lat/lon is
 * derived from the parcel polygon centroid (no point geometry on this layer).
 * Verified live 2026-06-01 (gismaps). See /docs/data-sources.md.
 *
 * Privacy note: this layer DOES carry buyer/seller names (a public excise
 * record). We deliberately request NONE of those fields — ParcelWatch surfaces
 * built-environment facts only, never data keyed to individuals by name
 * (RCW 42.56.070(9), see /docs/privacy.md).
 */

/** "Property sales in the last 3 years" layer on both hosts (same path). */
const SALES_QUERY_HOSTS = [
  "https://gisdata.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/3/query",
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/3/query",
];

/** Non-owner-identifying fields only (see privacy note above). */
const SALE_FIELDS =
  "PIN,address,SaleDate,SalePrice,Property_Type,Principal_Use,Property_Class,ForestLand,CurrentUseLand,NonProfitUse";

/**
 * Floor to drop non-market transfers (quitclaims, family/$0 transfers, fee
 * corrections). Market sales clear this comfortably; it is intentionally low so
 * legitimate bare-land sales survive.
 */
const MIN_MARKET_PRICE = 25000;

interface SaleAttributes {
  PIN: string;
  address: string | null;
  SaleDate: number | null; // epoch milliseconds (Esri date)
  SalePrice: number | null;
  Property_Type: string | null;
  Principal_Use: string | null;
  Property_Class: string | null;
  ForestLand: string | null;
  CurrentUseLand: string | null;
  NonProfitUse: string | null;
}

export interface RawSale {
  pin: string;
  address: string | null;
  /** ISO date (YYYY-MM-DD) of the recorded sale, or null. */
  saleDate: string | null;
  salePrice: number | null;
  /** Coarse type, e.g. "LAND ONLY", "LAND WITH PREV USED BLDG", "NA". */
  propertyType: string | null;
  /** Coarse use, e.g. "RESIDENTIAL", "CONDOMINIUM", "COMMERCIAL". */
  principalUse: string | null;
  /** Class, e.g. "Res-Improved property" vs land. */
  propertyClass: string | null;
  /** True when the class indicates an improved (built-on) parcel. */
  improved: boolean;
  lat: number | null;
  lon: number | null;
}

function isoFromEpoch(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function cleanText(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

function toRawSale(attributes: SaleAttributes, geometry: unknown): RawSale {
  const c = polygonRingCentroid(geometry);
  const cls = cleanText(attributes.Property_Class);
  return {
    pin: attributes.PIN,
    address: cleanText(attributes.address),
    saleDate: isoFromEpoch(attributes.SaleDate),
    salePrice: attributes.SalePrice ?? null,
    propertyType: cleanText(attributes.Property_Type),
    principalUse: cleanText(attributes.Principal_Use),
    propertyClass: cls,
    improved: cls != null && /improv/i.test(cls),
    lat: c?.lat ?? null,
    lon: c?.lon ?? null,
  };
}

/** Try each host in order; first one returning JSON wins (graceful failover). */
async function querySales(opts: {
  where: string;
  point?: { lat: number; lon: number };
  distanceMeters?: number;
  returnGeometry: boolean;
  resultRecordCount?: number;
}): Promise<RawSale[]> {
  let lastErr: unknown;
  for (const queryUrl of SALES_QUERY_HOSTS) {
    try {
      const res = await queryLayer<SaleAttributes>({
        queryUrl,
        where: opts.where,
        outFields: SALE_FIELDS,
        orderByFields: "SaleDate DESC",
        returnGeometry: opts.returnGeometry,
        outSR: opts.returnGeometry ? "4326" : undefined,
        resultRecordCount: opts.resultRecordCount,
        point: opts.point,
        distanceMeters: opts.distanceMeters,
      });
      return (res.features ?? []).map((f) => toRawSale(f.attributes, f.geometry));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new ArcgisError("King County sales service is unavailable");
}

/**
 * Recent recorded sales within a radius of a point. Excludes current-use,
 * forest, and non-profit transfers (not market value) and sub-floor prices.
 */
export async function searchNearbySales(opts: {
  lat: number;
  lon: number;
  radiusMeters?: number;
  excludePin?: string;
  limit?: number;
}): Promise<RawSale[]> {
  const wheres = [
    `SalePrice>=${MIN_MARKET_PRICE}`,
    `ForestLand='N'`,
    `CurrentUseLand='N'`,
    `NonProfitUse='N'`,
  ];
  if (opts.excludePin) {
    wheres.push(`PIN<>'${escapeArcgisLiteral(opts.excludePin)}'`);
  }
  return querySales({
    where: wheres.join(" AND "),
    point: { lat: opts.lat, lon: opts.lon },
    distanceMeters: opts.radiusMeters ?? 1600,
    returnGeometry: true,
    resultRecordCount: opts.limit ?? 60,
  });
}

/** The subject parcel's own recent sale history (by PIN). */
export async function getSalesByPin(pin: string): Promise<RawSale[]> {
  return querySales({
    where: `PIN='${escapeArcgisLiteral(pin)}'`,
    returnGeometry: false,
    resultRecordCount: 10,
  });
}

export { MIN_MARKET_PRICE };
