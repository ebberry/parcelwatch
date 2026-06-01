"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/db";
import { watches } from "@/db/schema";

/**
 * Start watching local government activity from the report — the report→alerts
 * on-ramp at the point of intent. Signed-out users are sent to sign-in and
 * returned here; signed-in users get a (deduped) council watch, then land on
 * their alerts. Parcel-specific change-watches (assessment, permits) are a
 * follow-up that needs new watch kinds + pollers.
 */
export async function watchThisArea(formData: FormData): Promise<void> {
  const parcelId = String(formData.get("parcelId") ?? "").trim() || null;
  const session = await getSession();
  if (!session) {
    const back = parcelId ? `/parcel/${parcelId}` : "/";
    redirect(`/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  const db = getDb();
  const existing = await db
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.userId, session.userId), eq(watches.kind, "council")))
    .limit(1);
  if (!existing.length) {
    await db.insert(watches).values({
      userId: session.userId,
      parcelId,
      kind: "council",
      topics: [],
      digestFrequency: "weekly",
    });
  }
  redirect("/alerts");
}
