// Manual end-to-end check of the digest pipeline. Forces the dev-capture mail
// path (writes to /tmp, never sends), seeds a throwaway user + watch + alerts,
// runs runDueDigests, prints the result, then cleans up.
//   npx tsx --env-file=.env jobs/test-digest.ts
process.env.EMAIL_SERVER = ""; // dev-capture, no real send
process.env.APP_URL = "https://parcelwatch.ebberry.com";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, watches, alerts, digestState } from "@/db/schema";
import { runDueDigests } from "@/lib/digest/service";

const UID = "test-digest-user";

async function cleanup(db: ReturnType<typeof getDb>) {
  await db.delete(alerts).where(eq(alerts.userId, UID));
  await db.delete(watches).where(eq(watches.userId, UID));
  await db.delete(digestState).where(eq(digestState.userId, UID));
  await db.delete(users).where(eq(users.id, UID));
}

async function main() {
  const db = getDb();
  await cleanup(db);
  await db.insert(users).values({ id: UID, email: "test@example.com" });
  await db.insert(watches).values([
    { userId: UID, parcelId: "0221029065", kind: "assessment", active: true },
    { userId: UID, parcelId: null, kind: "council", active: true },
  ]);
  await db.insert(alerts).values([
    {
      userId: UID,
      parcelId: null,
      kind: "council",
      title: "Ordinance 2026-12 — rural setbacks",
      detail: "Introduced; first reading scheduled.",
      url: "https://kingcounty.gov/x",
      source: "King County Council",
      topics: [],
    },
    {
      userId: UID,
      parcelId: null,
      kind: "legislature",
      title: "HB 1234 — shoreline permitting",
      detail: null,
      url: "https://leg.wa.gov/y",
      source: "WA Legislature",
      topics: [],
    },
  ]);

  const r = await runDueDigests();
  console.log("DIGEST RESULT:", JSON.stringify(r));

  await cleanup(db);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
