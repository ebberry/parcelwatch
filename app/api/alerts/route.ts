import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAlerts, getUnreadAlertCount, markAllAlertsRead } from "@/lib/watches/service";

/** GET /api/alerts — the user's alert feed + unread count. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [items, unread] = await Promise.all([
    getAlerts(session.userId),
    getUnreadAlertCount(session.userId),
  ]);
  return NextResponse.json({ alerts: items, unread });
}

/** POST /api/alerts — mark all of the user's alerts read. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await markAllAlertsRead(session.userId);
  return NextResponse.json({ ok: true });
}
