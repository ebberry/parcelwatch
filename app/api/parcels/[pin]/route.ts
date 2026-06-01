import { NextResponse } from "next/server";
import { getParcelCore } from "@/lib/parcels/service";

/** GET /api/parcels/:pin — a parcel's core facts as a SourcedValue. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pin: string }> },
) {
  const { pin } = await params;
  const sourced = await getParcelCore(pin);
  // Always 200 — an unavailable source is a valid, honest state, not an HTTP error.
  return NextResponse.json(sourced);
}
