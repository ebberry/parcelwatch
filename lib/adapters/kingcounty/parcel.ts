import type { DataSourceAdapter, ParcelLookupContext } from "@/lib/adapters/types";
import {
  KC_OPENDATA_BASE,
  queryLayer,
  escapeArcgisLiteral,
  ArcgisError,
  type ArcgisQueryResponse,
} from "./client";

/**
 * King County parcel adapter — Slice 1 core.
 *
 * Source: the denormalized `property__parcel_address_area` layer (1722), which
 * joins parcel + address + assessor attributes in one query (verified
 * 2026-05-31, see /docs/data-sources.md). One fetch yields PIN, address,
 * coordinates, lot size, zoning, and present use.
 *
 * Privacy: this layer carries NO owner-name field. We only read property /
 * built-environment attributes (see /docs/privacy.md).
 */

const PARCEL_ADDRESS_QUERY = `${KC_OPENDATA_BASE}/property__parcel_address_area/MapServer/1722/query`;

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
  "LEGALDESC",
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
  LEGALDESC: string | null;
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
  legalDescription: string | null;
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
    const res = await queryLayer<RawParcelAttributes>({
      queryUrl: PARCEL_ADDRESS_QUERY,
      where: `PIN='${escapeArcgisLiteral(pin)}'`,
      outFields: DETAIL_FIELDS,
      returnGeometry: false,
    });
    const feature = pickPrimary(res);
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
      legalDescription: cleanText(raw.LEGALDESC),
      assessment: buildAssessment(raw),
    };
  },
};

/** Prefer the primary-address row for a PIN; fall back to the first feature. */
function pickPrimary(
  res: ArcgisQueryResponse<RawParcelAttributes>,
): RawParcelAttributes | null {
  const features = res.features ?? [];
  if (!features.length) return null;
  const primary = features.find((f) => f.attributes.PRIMARY_ADDR === 1);
  return (primary ?? features[0]).attributes;
}

/**
 * Address search — the "confirm the parcel" step. Returns candidates the user
 * picks from. Not a DataSourceAdapter (it resolves an address to parcels rather
 * than fetching one parcel's facts). Returns [] on no match; throws ArcgisError
 * if the source is unreachable (callers degrade gracefully).
 */
export async function searchParcelsByAddress(
  rawQuery: string,
): Promise<ParcelCandidate[]> {
  const term = sanitizeAddressTerm(rawQuery);
  if (!term) return [];

  const res = await queryLayer<RawParcelAttributes>({
    queryUrl: PARCEL_ADDRESS_QUERY,
    where: `ADDR_FULL LIKE '%${escapeArcgisLiteral(term)}%'`,
    outFields: SEARCH_FIELDS,
    returnGeometry: false,
    orderByFields: "ADDR_FULL",
    resultRecordCount: 25,
  });

  // Dedupe by PIN, preferring the primary-address row.
  const byPin = new Map<string, ParcelCandidate>();
  for (const f of res.features ?? []) {
    const a = f.attributes;
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
