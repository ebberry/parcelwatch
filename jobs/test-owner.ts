// Roundtrip check for the account-store (owner inputs) + digest preferences.
//   npx tsx --env-file=.env jobs/test-owner.ts
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ownerInputs, digestState } from "@/db/schema";
import { getOwnerInputs, setOwnerInput, clearOwnerInput } from "@/lib/owner/inputs";
import { getDigestState, setDigestOptOut } from "@/lib/digest/service";

const U = "test-owner-user";
const P = "0221029065";

async function main() {
  const db = getDb();
  await db.delete(ownerInputs).where(eq(ownerInputs.userId, U));
  await db.delete(digestState).where(eq(digestState.userId, U));

  // soil + water roundtrip
  await setOwnerInput(U, P, "soil_arsenic_ppm", 140);
  await setOwnerInput(U, P, "water_system", { name: "Vashon Water", group: "A", status: "Active", manual: false });
  const a = await getOwnerInputs(U, P);
  console.log("OWNER INPUTS:", JSON.stringify(a));

  await clearOwnerInput(U, P, "soil_arsenic_ppm");
  const b = await getOwnerInputs(U, P);
  console.log("AFTER CLEAR SOIL:", JSON.stringify(b));

  // digest prefs roundtrip
  console.log("DIGEST STATE (default):", JSON.stringify(await getDigestState(U)));
  await setDigestOptOut(U, true);
  console.log("DIGEST STATE (opted out):", JSON.stringify(await getDigestState(U)));

  await db.delete(ownerInputs).where(eq(ownerInputs.userId, U));
  await db.delete(digestState).where(eq(digestState.userId, U));
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
