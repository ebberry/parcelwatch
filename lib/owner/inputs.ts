import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ownerInputs } from "@/db/schema";

/**
 * Owner-entered values tied to (account, parcel). The set of keys is closed and
 * lives here so callers/actions can't write arbitrary keys. Anonymous users keep
 * these in localStorage; signed-in users persist them here (and we migrate the
 * local copy up on sign-in).
 */
export type OwnerInputKey = "soil_arsenic_ppm" | "water_system";

export interface OwnerInputs {
  soil_arsenic_ppm?: number;
  water_system?: { name: string; group: string | null; status: string | null; manual: boolean };
}

export async function getOwnerInputs(userId: string, parcelId: string): Promise<OwnerInputs> {
  const db = getDb();
  const rows = await db
    .select({ key: ownerInputs.key, value: ownerInputs.value })
    .from(ownerInputs)
    .where(and(eq(ownerInputs.userId, userId), eq(ownerInputs.parcelId, parcelId)));
  const out: OwnerInputs = {};
  for (const r of rows) {
    if (r.key === "soil_arsenic_ppm" && typeof r.value === "number") out.soil_arsenic_ppm = r.value;
    else if (r.key === "water_system" && r.value && typeof r.value === "object")
      out.water_system = r.value as OwnerInputs["water_system"];
  }
  return out;
}

export async function setOwnerInput(
  userId: string,
  parcelId: string,
  key: OwnerInputKey,
  value: unknown,
): Promise<void> {
  const db = getDb();
  await db
    .insert(ownerInputs)
    .values({ userId, parcelId, key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [ownerInputs.userId, ownerInputs.parcelId, ownerInputs.key],
      set: { value, updatedAt: new Date() },
    });
}

export async function clearOwnerInput(
  userId: string,
  parcelId: string,
  key: OwnerInputKey,
): Promise<void> {
  const db = getDb();
  await db
    .delete(ownerInputs)
    .where(
      and(
        eq(ownerInputs.userId, userId),
        eq(ownerInputs.parcelId, parcelId),
        eq(ownerInputs.key, key),
      ),
    );
}
