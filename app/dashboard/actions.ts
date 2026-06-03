"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { setDigestOptOut, sendUserDigest } from "@/lib/digest/service";

const DAY = 24 * 60 * 60 * 1000;

/** Turn the monthly digest email on/off from the dashboard. */
export async function setDigestPreference(formData: FormData): Promise<void> {
  const optOut = String(formData.get("optOut") ?? "") === "true";
  const session = await getSession();
  if (!session) return;
  await setDigestOptOut(session.userId, optOut);
  revalidatePath("/dashboard");
}

/**
 * "Send me a test digest now" — the activation check. Sends the current user a
 * digest immediately (last ~month of alerts) without stamping lastDigestAt, so
 * it doesn't suppress the real monthly send.
 */
export async function sendTestDigest(): Promise<void> {
  const session = await getSession();
  if (!session?.email) return;
  const since = new Date(Date.now() - 31 * DAY);
  await sendUserDigest(session.userId, session.email, since, new Date(), { stamp: false });
  revalidatePath("/dashboard");
}
