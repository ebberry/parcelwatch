"use server";

import { getSession } from "@/lib/auth";
import { setOwnerInput, clearOwnerInput, type OwnerInputs } from "@/lib/owner/inputs";

/**
 * Server actions for owner-entered values (soil test, water system). Each writes
 * the closed key set in lib/owner/inputs — the client can't set arbitrary keys.
 * Called by the report's client components when the user is signed in; they fall
 * back to localStorage when signed out. Return false if there's no session so the
 * client keeps the local copy.
 */

export async function saveSoilArsenic(
  parcelId: string,
  ppm: number | null,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !parcelId) return { ok: false };
  if (ppm == null || !Number.isFinite(ppm)) {
    await clearOwnerInput(session.userId, parcelId, "soil_arsenic_ppm");
  } else {
    await setOwnerInput(session.userId, parcelId, "soil_arsenic_ppm", ppm);
  }
  return { ok: true };
}

export async function saveWaterSystem(
  parcelId: string,
  system: OwnerInputs["water_system"] | null,
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !parcelId) return { ok: false };
  if (!system) {
    await clearOwnerInput(session.userId, parcelId, "water_system");
  } else {
    await setOwnerInput(session.userId, parcelId, "water_system", system);
  }
  return { ok: true };
}
