import type { DataSourceAdapter, ParcelLookupContext } from "@/lib/adapters/types";
import {
  KC_OPENDATA_BASE,
  queryLayer,
  escapeArcgisLiteral,
  ArcgisError,
  type ArcgisFeature,
} from "./client";

/**
 * King County parcel adapter — Slice 1 core.
 *
 * PRIMARY source: the `gismaps` host's KingCo_PropertyInfo Parcels layer (2).
 * We promoted it to primary on 2026-06-02 because the former primary — the
 * OpenDataPortal (gisdata) `property__parcel_address_area` layer (1722) — was
 * RETIRED on 2026-06-01 (it now returns a non-JSON redirect for every query).
 * Lat/lon is absent on this layer, so it's derived from the parcel polygon
 * centroid; a few fields (legal description, tax year, levy, account number) are
 * not on it and surface as "not available" — those are restored by the Assessor
 * EXTR ingestion (see /docs/specs/living-area-comps.md).
 *
 * FAILOVER: if gismaps ever fails, we still try the old gisdata layer (cheap
 * insurance in case it's resurrected). See /docs/data-sources.md.
 *
 * Privacy: neither layer carries an owner-name field (see /docs/privacy.md).
 */

/** PRIMARY (live): gismaps KingCo_PropertyInfo Parcels layer. Subset of fields. */
const GISMAPS_PARCEL_QUERY =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer/2/query";
const GISMAPS_FIELDS =
  "PIN,MAJOR,MINOR,ADDR_FULL,POSTALCTYNAME,CTYNAME,ZIP5,PLAT_NAME,LOTSQFT,KCA_ACRES,KCA_ZONING,PREUSE_CODE,PREUSE_DESC,PROPTYPE,APPRLNDVAL,APPR_IMPR";

/** Retired fallback (gisdata 1722) — kept only as insurance if it's resurrected. */
const GISDATA_PARCEL_QUERY = `${KC_OPENDATA_BASE}/property__parcel_address_area/MapServer/1722/query`;

const DETAIL_FIELDS = [
  "PIN",
  "MAJOR",
  "MINOR",
  "ADDR_FULL",
  "POSTALCTYNAME",
  "CTYNAME",
  "ZIP5",
  "LAT",
  "LON",
  "LOTSQFT",
  "KCA_ACRES",
  "KCA_ZONING",
  "PREUSE_CODE",
  "PREUSE_DESC",
  "PROPTYPE",
  "PLAT_NAME",
  "PRIMARY_ADDR",
  // Slice 2 — assessment/valuation (same row, no extra request).
  "APPRLNDVAL",
  "APPR_IMPR",
  "TAX_LNDVAL",
  "TAX_IMPR",
  "LEVYCODE",
  "LEVY_JURIS",
  "KCTP_TAXYR",
  "ACCNT_NUM",
].join(",");

const SEARCH_FIELDS = "PIN,ADDR_FULL,POSTALCTYNAME,ZIP5,LAT,LON,PRIMARY_ADDR";

/** King County PIN: 10 digits, leading zeros significant. */
const PIN_RE = /^\d{10}$/;

/** Raw attribute shape returned by layer 1722 (fields we request). */
export interface RawParcelAttributes {
  PIN: string;
  MAJOR: string | null;
  MINOR: string | null;
  ADDR_FULL: string | null;
  POSTALCTYNAME: string | null;
  CTYNAME: string | null;
  ZIP5: string | null;
  LAT: number | null;
  LON: number | null;
  LOTSQFT: number | null;
  KCA_ACRES: number | null;
  KCA_ZONING: string | null;
  PREUSE_CODE: number | null;
  PREUSE_DESC: string | null;
  PROPTYPE: string | null;
  PLAT_NAME: string | null;
  PRIMARY_ADDR: number | null;
  APPRLNDVAL: number | null;
  APPR_IMPR: number | null;
  TAX_LNDVAL: number | null;
  TAX_IMPR: number | null;
  LEVYCODE: string | null;
  LEVY_JURIS: string | null;
  KCTP_TAXYR: number | null;
  ACCNT_NUM: string | null;
}

/** Assessment / valuation facts (Slice 2). Dollar values are whole dollars. */
export interface Assessment {
  appraisedLand: number | null;
  appraisedImprovement: number | null;
  /** Computed land + improvement when both are present; otherwise null. */
  appraisedTotal: number | null;
  taxableLand: number | null;
  taxableImprovement: number | null;
  taxableTotal: number | null;
  taxYear: number | null;
  levyCode: string | null;
  levyJurisdiction: string | null;
  /** County tax account number — used to deep-link the official record. */
  accountNumber: string | null;
}

/** Our clean internal shape for a parcel's core facts. */
export interface ParcelCore {
  pin: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  lotSqFt: number | null;
  acres: number | null;
  zoningCode: string | null;
  presentUseCode: number | null;
  presentUse: string | null;
  propertyType: string | null;
  /** Subdivision / plat name (PLAT_NAME), when the parcel is in a named plat. */
  platName: string | null;
  assessment: Assessment | null;
}

/** A lightweight candidate from address search (the confirm-the-parcel step). */
export interface ParcelCandidate {
  pin: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
}

/** Trim fixed-width padding; collapse internal runs of whitespace; null-empty. */
function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length ? collapsed : null;
}

/** Sum two dollar components only when both are present — never invent a total. */
function sumIfBoth(a: number | null, b: number | null): number | null {
  return a != null && b != null ? a + b : null;
}

/** Build the assessment sub-shape; null when the row carries no valuation. */
function buildAssessment(raw: RawParcelAttributes): Assessment | null {
  const appraisedLand = raw.APPRLNDVAL ?? null;
  const appraisedImprovement = raw.APPR_IMPR ?? null;
  const taxableLand = raw.TAX_LNDVAL ?? null;
  const taxableImprovement = raw.TAX_IMPR ?? null;
  const taxYear = raw.KCTP_TAXYR ?? null;
  const levyCode = cleanText(raw.LEVYCODE);
  const levyJurisdiction = cleanText(raw.LEVY_JURIS);
  const accountNumber = cleanText(raw.ACCNT_NUM);

  const hasAny =
    appraisedLand != null ||
    appraisedImprovement != null ||
    taxableLand != null ||
    taxableImprovement != null ||
    taxYear != null ||
    levyCode != null ||
    accountNumber != null;
  if (!hasAny) return null;

  return {
    appraisedLand,
    appraisedImprovement,
    appraisedTotal: sumIfBoth(appraisedLand, appraisedImprovement),
    taxableLand,
    taxableImprovement,
    taxableTotal: sumIfBoth(taxableLand, taxableImprovement),
    taxYear,
    levyCode,
    levyJurisdiction,
    accountNumber,
  };
}

/** Deep-link to King County's official eReal Property record (verified 2026-05-31). */
export function eRealPropertyUrl(pin: string): string {
  return `https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=${encodeURIComponent(pin)}`;
}

/** Rough centroid of a polygon's first ring (geometry in WGS84). */
function ringCentroid(geometry: unknown): { lat: number; lon: number } | null {
  const ring = (geometry as { rings?: number[][][] } | null)?.rings?.[0];
  if (!ring?.length) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return { lon: sx / ring.length, lat: sy / ring.length };
}

/** Map a gismaps-fallback feature into the full RawParcelAttributes shape. */
function fromFallback(f: ArcgisFeature<Partial<RawParcelAttributes>>): RawParcelAttributes {
  const a = f.attributes;
  const c = ringCentroid(f.geometry);
  return {
    PIN: a.PIN ?? "",
    MAJOR: a.MAJOR ?? null,
    MINOR: a.MINOR ?? null,
    ADDR_FULL: a.ADDR_FULL ?? null,
    POSTALCTYNAME: a.POSTALCTYNAME ?? null,
    CTYNAME: a.CTYNAME ?? null,
    ZIP5: a.ZIP5 ?? null,
    LAT: c?.lat ?? null,
    LON: c?.lon ?? null,
    LOTSQFT: a.LOTSQFT ?? null,
    KCA_ACRES: a.KCA_ACRES ?? null,
    KCA_ZONING: a.KCA_ZONING ?? null,
    PREUSE_CODE: a.PREUSE_CODE ?? null,
    PREUSE_DESC: a.PREUSE_DESC ?? null,
    PROPTYPE: a.PROPTYPE ?? null,
    PLAT_NAME: a.PLAT_NAME ?? null,
    PRIMARY_ADDR: null,
    APPRLNDVAL: a.APPRLNDVAL ?? null,
    APPR_IMPR: a.APPR_IMPR ?? null,
    TAX_LNDVAL: null,
    TAX_IMPR: null,
    LEVYCODE: null,
    LEVY_JURIS: null,
    KCTP_TAXYR: null,
    ACCNT_NUM: null,
  };
}

/**
 * Run a parcel query against the live gismaps host; if it ever fails, try the
 * retired gisdata layer as insurance. Returns the uniform RawParcelAttributes
 * shape. `richFields` is the (richer) field list to request IF gisdata answers.
 */
async function queryParcels(opts: {
  where: string;
  richFields: string;
  orderByFields?: string;
  resultRecordCount?: number;
  /** Derive lat/lon from polygon geometry on gismaps (needed for by-PIN). */
  withGeometry?: boolean;
}): Promise<RawParcelAttributes[]> {
  try {
    // PRIMARY: gismaps (live). Lat/lon from the polygon centroid when needed.
    const res = await queryLayer<Partial<RawParcelAttributes>>({
      queryUrl: GISMAPS_PARCEL_QUERY,
      where: opts.where,
      outFields: GISMAPS_FIELDS,
      returnGeometry: Boolean(opts.withGeometry),
      outSR: opts.withGeometry ? "4326" : undefined,
      orderByFields: opts.orderByFields,
      resultRecordCount: opts.resultRecordCount,
    });
    return (res.features ?? []).map(fromFallback);
  } catch {
    // Insurance: the retired gisdata layer (richer fields) if it's resurrected.
    const res = await queryLayer<RawParcelAttributes>({
      queryUrl: GISDATA_PARCEL_QUERY,
      where: opts.where,
      outFields: opts.richFields,
      returnGeometry: false,
      orderByFields: opts.orderByFields,
      resultRecordCount: opts.resultRecordCount,
    });
    return (res.features ?? []).map((f) => f.attributes);
  }
}

export const kingCountyParcelAdapter: DataSourceAdapter<
  RawParcelAttributes,
  ParcelCore
> = {
  id: "kingcounty.parcel",
  sourceLabel: "King County Assessor (parcel layer)",
  // Parcel/assessor attributes change infrequently; refresh daily.
  refreshTtlSeconds: 24 * 60 * 60,

  async fetchRaw(input: ParcelLookupContext): Promise<RawParcelAttributes> {
    const pin = input.parcelId;
    if (!pin || !PIN_RE.test(pin)) {
      throw new ArcgisError(`Invalid King County PIN: ${pin ?? "(none)"}`);
    }
    const rows = await queryParcels({
      where: `PIN='${escapeArcgisLiteral(pin)}'`,
      richFields: DETAIL_FIELDS,
      withGeometry: true, // gismaps lat/lon comes from the polygon centroid
    });
    // Prefer the primary-address row (only present on the primary layer).
    const feature = rows.find((r) => r.PRIMARY_ADDR === 1) ?? rows[0];
    if (!feature) {
      throw new ArcgisError(`No King County parcel found for PIN ${pin}`);
    }
    return feature;
  },

  normalize(raw: RawParcelAttributes): ParcelCore {
    return {
      pin: raw.PIN,
      address: cleanText(raw.ADDR_FULL),
      // CTYNAME is frequently null on this layer; POSTALCTYNAME is reliable.
      city: cleanText(raw.POSTALCTYNAME) ?? cleanText(raw.CTYNAME),
      zip: cleanText(raw.ZIP5),
      lat: raw.LAT ?? null,
      lon: raw.LON ?? null,
      lotSqFt: raw.LOTSQFT ?? null,
      acres: raw.KCA_ACRES ?? null,
      zoningCode: cleanText(raw.KCA_ZONING),
      presentUseCode: raw.PREUSE_CODE ?? null,
      presentUse: cleanText(raw.PREUSE_DESC),
      propertyType: cleanText(raw.PROPTYPE),
      platName: cleanText(raw.PLAT_NAME),
      assessment: buildAssessment(raw),
    };
  },
};

/**
 * Address search — the "confirm the parcel" step. Returns candidates the user
 * picks from. Not a DataSourceAdapter (it resolves an address to parcels rather
 * than fetching one parcel's facts). Returns [] on no match; throws if BOTH the
 * primary and fallback hosts are unreachable (callers degrade gracefully).
 */
export async function searchParcelsByAddress(
  rawQuery: string,
): Promise<ParcelCandidate[]> {
  const term = sanitizeAddressTerm(rawQuery);
  if (!term) return [];

  const rows = await queryParcels({
    where: `ADDR_FULL LIKE '%${escapeArcgisLiteral(term)}%'`,
    richFields: SEARCH_FIELDS,
    orderByFields: "ADDR_FULL",
    resultRecordCount: 25,
  });

  // Dedupe by PIN, preferring the primary-address row.
  const byPin = new Map<string, ParcelCandidate>();
  for (const a of rows) {
    const existing = byPin.get(a.PIN);
    if (existing && a.PRIMARY_ADDR !== 1) continue;
    byPin.set(a.PIN, {
      pin: a.PIN,
      address: cleanText(a.ADDR_FULL),
      city: cleanText(a.POSTALCTYNAME),
      zip: cleanText(a.ZIP5),
      lat: a.LAT ?? null,
      lon: a.LON ?? null,
    });
  }
  return [...byPin.values()];
}

/**
 * Normalize a user-typed address for a LIKE search: uppercase (the layer stores
 * uppercase), keep only address-safe characters, cap length. Single quotes are
 * escaped at the query layer; this strips other noise.
 */
export function sanitizeAddressTerm(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 #\-./']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export { PIN_RE, cleanText };
