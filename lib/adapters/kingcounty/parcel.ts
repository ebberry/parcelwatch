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
