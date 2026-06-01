"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/db";
import { watches } from "@/db/schema";

/** Kinds a user can start from the report (council is jurisdiction-wide). */
const ALLOWED = new Set(["assessment", "sales", "council"]);

/**
 * Toggle a watch from the report — the report→alerts on-ramp at the point of
 * intent. Signed-out users are routed through sign-in and returned here.
 *
 * - Parcel kinds (assessment, sales) are scoped to this parcel.
 * - Council is jurisdiction-wide, so we keep ONE per user (no per-parcel dupes
 *   that would double the alerts).
 */
export async function setWatch(formData: FormData): Promise<void> {
  const parcelId = String(formData.get("parcelId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const enable = String(formData.get("enable") ?? "true") === "true";
  if (!ALLOWED.has(kind) || !parcelId) return;

  const session = await getSession();
  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/parcel/${parcelId}`)}`);
  }

  const db = getDb();
  // Council dedupes by (user, kind); parcel kinds by (user, parcel, kind).
  const where =
    kind === "council"
      ? and(eq(watches.userId, session.userId), eq(watches.kind, "council"))
      : and(
          eq(watches.userId, session.userId),
          eq(watches.kind, kind),
          eq(watches.parcelId, parcelId),
        );

  const existing = await db.select({ id: watches.id }).from(watches).where(where).limit(1);
  if (existing.length) {
    await db.update(watches).set({ active: enable }).where(eq(watches.id, existing[0].id));
  } else if (enable) {
    // Keep the originating parcel even for council (one per user via the dedup
    // above) — it's the user's saved address, which the worker uses to warm the
    // AI cache for their jurisdiction.
    await db.insert(watches).values({
      userId: session.userId,
      parcelId,
      kind,
      topics: [],
      digestFrequency: "weekly",
    });
  }

  revalidatePath(`/parcel/${parcelId}`);
}
