import { NextResponse } from "next/server";
import { searchWaterSystems } from "@/lib/adapters/doh/water";

/** GET /api/water/search?q=<name> — water systems for the manual picker. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ matches: [] });
  }
  try {
    const matches = await searchWaterSystems(q);
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ matches: [], unavailable: true });
  }
}
