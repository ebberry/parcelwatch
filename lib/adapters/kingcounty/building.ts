import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { kcResBldg } from "@/db/schema";

/**
 * Read building characteristics (living-area sqft, year built, beds, baths) for
 * a set of PINs from the ingested EXTR_ResBldg table. This is what makes
 * $/living-sqft comparables possible. Returns an empty map if the table hasn't
 * been ingested yet (graceful — comps fall back to non-size-adjusted).
 */

export interface BuildingChars {
  sqftLiving: number | null;
  yearBuilt: number | null;
  bedrooms: number | null;
  bathFull: number | null;
}

export async function getBuildingByPins(
  pins: string[],
): Promise<Map<string, BuildingChars>> {
  const unique = [...new Set(pins.filter(Boolean))];
  const out = new Map<string, BuildingChars>();
  if (!unique.length) return out;
  try {
    const rows = await getDb()
      .select()
      .from(kcResBldg)
      .where(inArray(kcResBldg.pin, unique));
    for (const r of rows) {
      out.set(r.pin, {
        sqftLiving: r.sqftLiving,
        yearBuilt: r.yearBuilt,
        bedrooms: r.bedrooms,
        bathFull: r.bathFull,
      });
    }
  } catch {
    // Table not present / not yet ingested — degrade to no sqft.
  }
  return out;
}
