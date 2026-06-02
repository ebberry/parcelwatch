import { unavailable, type SourcedValue } from "@/lib/provenance";

/**
 * King County Public Health — septic vs sewer + on-site sewage records.
 *
 * Critical on Vashon, where most parcels are on septic. Two layers of the
 * gismaps `Utility/KingCo_Septic` MapServer, both keyed by PIN (we query by PIN,
 * not point — exact, no centroid drift):
 *   layer 2 "Wastewater treatment type" → septic vs sewer + sewer agency
 *   layer 3 "Septic and Group B records" → counts of records on file (as-builts)
 *
 * The gisdata OpenDataPortal copy is retired (302 → homepage); gismaps is the
 * live successor. Each layer degrades independently.
 */

const SEPTIC_MS =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Utility/KingCo_Septic/MapServer";

/** Public Health "Septic and Group B Records Search" instant app (link-out). */
export const SEPTIC_RECORDS_URL =
  "https://www.arcgis.com/apps/instant/sidebar/index.html?appid=6c0bbaa4339c4ffab0c53cfe1f8d3d85";

const SOURCE = "King County Public Health — septic/sewer records";

export type Treatment = "septic" | "sewer" | "vacant" | "other" | "unknown";

export interface SepticStatus {
  treatment: Treatment;
  /** Verbatim WastewaterTreatmentType (e.g. "on-site sewage system"). */
  raw: string | null;
  /** Serving sewer agency, when on sewer. */
  sewerAgency: string | null;
  /** Counts of records on file (overlapping categories), when the parcel has any. */
  records: { onlineRME: number; sewage: number; groupB: number } | null;
  recordsUrl: string;
}

/** Map King County's treatment-type string to a clean enum. Pure, testable. */
export function normalizeTreatment(raw: string | null | undefined): Treatment {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.startsWith("on-site sewage")) return "septic";
  if (s.startsWith("sewer")) return "sewer";
  if (s.startsWith("vacant")) return "vacant";
  return "other";
}

async function queryJson(url: string): Promise<{ attributes: Record<string, unknown> }[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 * 7 }, // weekly-ish source
  });
  if (!res.ok) throw new Error(`septic ${res.status}`);
  const data = (await res.json()) as {
    features?: { attributes: Record<string, unknown> }[];
    error?: unknown;
  };
  if (data.error) throw new Error("septic query error");
  return data.features ?? [];
}

const N3 = "plibrary.utility.ilinx_orme_septic_doc_parcel";

export async function getSepticStatus(
  pin: string | null,
): Promise<SourcedValue<SepticStatus>> {
  if (!pin) return unavailable(SOURCE);
  const safe = pin.replace(/'/g, ""); // PINs are digits; defensive
  const treatmentUrl =
    `${SEPTIC_MS}/2/query?where=PIN='${safe}'` +
    `&outFields=WastewaterTreatmentType,SewerAgency,ExpSewerAgency&returnGeometry=false&f=json`;
  const recordsUrl =
    `${SEPTIC_MS}/3/query?where=${N3}.PIN='${safe}'` +
    `&outFields=${N3}.n_OnlineRME,${N3}.n_Sewage,${N3}.n_GroupB&returnGeometry=false&f=json`;

  const [treatRows, recRows] = await Promise.all([
    queryJson(treatmentUrl).catch(() => null),
    queryJson(recordsUrl).catch(() => null),
  ]);

  // Both sources down → unavailable. (No row found is a valid "unknown", not an error.)
  if (treatRows == null && recRows == null) return unavailable(SOURCE);

  const ta = treatRows?.[0]?.attributes;
  const raw = (ta?.WastewaterTreatmentType as string | undefined) ?? null;
  const sewerAgency =
    (ta?.SewerAgency as string | undefined) ??
    (ta?.ExpSewerAgency as string | undefined) ??
    null;

  const ra = recRows?.[0]?.attributes;
  const num = (k: string) => {
    const v = ra?.[`${N3}.${k}`];
    return typeof v === "number" ? v : 0;
  };
  const counts = ra
    ? { onlineRME: num("n_OnlineRME"), sewage: num("n_Sewage"), groupB: num("n_GroupB") }
    : null;
  const hasRecords = counts != null && counts.onlineRME + counts.sewage + counts.groupB > 0;

  return {
    value: {
      treatment: normalizeTreatment(raw),
      raw,
      sewerAgency: sewerAgency || null,
      records: hasRecords ? counts : null,
      recordsUrl: SEPTIC_RECORDS_URL,
    },
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    confidence: "live",
  };
}
