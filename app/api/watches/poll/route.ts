import { NextResponse } from "next/server";
import { runAllWatches } from "@/lib/watches/engine";

/**
 * POST /api/watches/poll — run all watch pollers (diff + create alerts).
 *
 * This is a SYSTEM job (the scheduled worker calls runAllWatches directly; this
 * route is a manual trigger for testing). It is gated by CRON_SECRET when one is
 * configured, so it can't be triggered by arbitrary visitors in production.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const results = await runAllWatches();
  return NextResponse.json({ results });
}
