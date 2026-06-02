import { unzipSync } from "fflate";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { kcResBldg } from "@/db/schema";

/**
 * Ingest King County Assessor `EXTR_ResBldg.csv` (the weekly bulk extract) into
 * Postgres. This is the ONLY source of living-area square footage (no keyless
 * live API exists), which unlocks $/living-sqft comparables in the appeals tool
 * and restores building characteristics the retired parcel layer used to lack.
 *
 * Verified live 2026-06-02: zip at the URL below, single CSV inside, ~532k rows,
 * column positions as in COL. Built-environment fields only — no owner names.
 *
 * Memory: the 21 MB zip decompresses to ~154 MB; we hold that one buffer and
 * scan it for newlines (native indexOf), decoding + upserting in batches, so
 * peak memory stays a few hundred MB — fine on the 2 GB box (plus swap).
 */

const ZIP_URL = "https://aqua.kingcounty.gov/extranet/assessor/Residential%20Building.zip";
const CSV_NAME = "EXTR_ResBldg.csv";

/** 0-based column indices (verified 2026-06-02 against the live header). */
const COL = {
  major: 0,
  minor: 1,
  bldgNbr: 2,
  grade: 13, // BldgGrade
  sqftLiving: 21, // SqFtTotLiving
  bedrooms: 35,
  bathFull: 38, // BathFullCount
  yearBuilt: 43, // YrBuilt
} as const;

const BATCH = 2000;

function unquote(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}
function toInt(s: string | undefined): number | null {
  if (s == null) return null;
  const n = parseInt(unquote(s), 10);
  return Number.isFinite(n) ? n : null;
}

interface Row {
  pin: string;
  sqftLiving: number | null;
  yearBuilt: number | null;
  bedrooms: number | null;
  bathFull: number | null;
  grade: number | null;
}

export interface IngestResult {
  rows: number;
  sourceDate: string;
  durationMs: number;
}

/** Download, parse, and upsert EXTR_ResBldg. Primary building (BldgNbr=1) per PIN. */
export async function ingestResBldg(): Promise<IngestResult> {
  const startedAt = Date.now();
  const res = await fetch(ZIP_URL, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`EXTR_ResBldg download HTTP ${res.status}`);
  const sourceDate =
    (res.headers.get("last-modified") ?? "").trim() ||
    new Date(Date.now()).toISOString().slice(0, 10);

  const zip = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(zip, { filter: (f) => f.name === CSV_NAME });
  const csv = files[CSV_NAME];
  if (!csv) throw new Error(`${CSV_NAME} not found in zip`);

  const db = getDb();
  const decoder = new TextDecoder();
  let batch: Row[] = [];
  let rows = 0;
  let lineNo = 0;

  const flush = async () => {
    if (!batch.length) return;
    await db
      .insert(kcResBldg)
      .values(batch.map((b) => ({ ...b, sourceDate })))
      .onConflictDoUpdate({
        target: kcResBldg.pin,
        set: {
          sqftLiving: sql`excluded.sqft_living`,
          yearBuilt: sql`excluded.year_built`,
          bedrooms: sql`excluded.bedrooms`,
          bathFull: sql`excluded.bath_full`,
          grade: sql`excluded.grade`,
          sourceDate: sql`excluded.source_date`,
          updatedAt: sql`now()`,
        },
      });
    batch = [];
  };

  let start = 0;
  while (start < csv.length) {
    let nl = csv.indexOf(0x0a, start);
    if (nl === -1) nl = csv.length;
    let end = nl;
    if (end > start && csv[end - 1] === 0x0d) end--; // strip CR
    lineNo++;
    if (lineNo > 1 && end > start) {
      const f = decoder.decode(csv.subarray(start, end)).split(",");
      if (f.length > COL.yearBuilt) {
        const major = unquote(f[COL.major]);
        const minor = unquote(f[COL.minor]);
        // Primary residence only — keeps one row per parcel.
        if (major && minor && unquote(f[COL.bldgNbr]) === "1") {
          batch.push({
            pin: major.padStart(6, "0") + minor.padStart(4, "0"),
            sqftLiving: toInt(f[COL.sqftLiving]),
            yearBuilt: toInt(f[COL.yearBuilt]),
            bedrooms: toInt(f[COL.bedrooms]),
            bathFull: toInt(f[COL.bathFull]),
            grade: toInt(f[COL.grade]),
          });
          rows++;
          if (batch.length >= BATCH) await flush();
        }
      }
    }
    start = nl + 1;
  }
  await flush();

  return { rows, sourceDate, durationMs: Date.now() - startedAt };
}
