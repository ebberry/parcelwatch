import { NextResponse } from "next/server";
import { searchParcels } from "@/lib/parcels/service";

/** GET /api/parcels/search?q=<address> — candidate parcels for the picker. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json(
      { candidates: [], unavailable: false, message: "Enter at least 3 characters." },
      { status: 400 },
    );
  }
  const result = await searchParcels(q);
  return NextResponse.json(result);
}
