import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureDefaultWatch } from "@/lib/watches/service";
import { runAllWatches } from "@/lib/watches/engine";

/**
 * POST /api/watches/poll — run all watch pollers (diff + create alerts).
 * Called by the scheduled worker; also usable manually for testing.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureDefaultWatch(session.userId, null);
  const results = await runAllWatches();
  return NextResponse.json({ results });
}
