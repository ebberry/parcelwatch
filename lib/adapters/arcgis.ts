/**
 * Generic keyless ArcGIS REST point/radius query, host-agnostic. Used by the
 * federal/state environment adapters (EPA, WA Ecology, WA DOH). Server-side
 * only; we manage freshness ourselves (cache: no-store) and time out for
 * graceful degradation.
 *
 * Note: some AGOL services misbehave with returnGeometry=true (reprojection
 * drops most rows — observed on WA Ecology). Prefer lat/lon attribute fields;
 * use returnGeometry only where a layer lacks coordinate fields (WA DOH).
 */

export interface ArcgisGeom {
  x: number;
  y: number;
}
export interface ArcgisFeature<A> {
  attributes: A;
  geometry?: ArcgisGeom | null;
}

export class ArcgisQueryError extends Error {}

export async function queryArcgisNearby<A>(opts: {
  queryUrl: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  outFields: string;
  where?: string;
  returnGeometry?: boolean;
  limit?: number;
  timeoutMs?: number;
}): Promise<ArcgisFeature<A>[]> {
  const params = new URLSearchParams({
    geometry: `${opts.lon},${opts.lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    distance: String(opts.distanceMeters),
    units: "esriSRUnit_Meter",
    spatialRel: "esriSpatialRelIntersects",
    where: opts.where ?? "1=1",
    outFields: opts.outFields,
    returnGeometry: String(opts.returnGeometry ?? false),
    f: "json",
  });
  if (opts.returnGeometry) params.set("outSR", "4326");
  if (opts.limit != null) params.set("resultRecordCount", String(opts.limit));

  let res: Response;
  try {
    res = await fetch(`${opts.queryUrl}?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
  } catch (e) {
    throw new ArcgisQueryError(`Network error: ${(e as Error).message}`);
  }
  if (!res.ok) throw new ArcgisQueryError(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    features?: ArcgisFeature<A>[];
    error?: { message: string };
  };
  if (json.error) throw new ArcgisQueryError(json.error.message);
  return json.features ?? [];
}
