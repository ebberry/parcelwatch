/**
 * Low-level ArcGIS REST query client for King County's hosted services.
 *
 * Keyless REST (`?f=json`), server-side only — the heavy Esri JS SDK is never
 * used here (see /docs/maps.md). Shared by all King County adapters.
 *
 * Endpoints verified live 2026-05-31 — see /docs/data-sources.md.
 */

export const KC_OPENDATA_BASE =
  "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal";

/** Shape of an ArcGIS FeatureServer/MapServer query response. */
export interface ArcgisFeature<A> {
  attributes: A;
  geometry?: unknown;
}

export interface ArcgisQueryResponse<A> {
  features?: ArcgisFeature<A>[];
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string; details?: string[] };
}

/** Escape a string literal for an ArcGIS SQL `where` clause (double the quotes). */
export function escapeArcgisLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export class ArcgisError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "ArcgisError";
  }
}

interface QueryOptions {
  /** Full `.../query` URL for the layer. */
  queryUrl: string;
  where: string;
  outFields: string;
  returnGeometry?: boolean;
  orderByFields?: string;
  resultRecordCount?: number;
  /** Optional point + radius buffer (intersects within `distanceMeters`). */
  point?: { lat: number; lon: number };
  distanceMeters?: number;
  /** Network timeout; failures surface as ArcgisError for graceful degradation. */
  timeoutMs?: number;
}

export async function queryLayer<A>(
  opts: QueryOptions,
): Promise<ArcgisQueryResponse<A>> {
  const params = new URLSearchParams({
    where: opts.where,
    outFields: opts.outFields,
    returnGeometry: String(opts.returnGeometry ?? false),
    f: "json",
  });
  if (opts.orderByFields) params.set("orderByFields", opts.orderByFields);
  if (opts.resultRecordCount != null) {
    params.set("resultRecordCount", String(opts.resultRecordCount));
  }
  if (opts.point) {
    params.set("geometry", `${opts.point.lon},${opts.point.lat}`);
    params.set("geometryType", "esriGeometryPoint");
    params.set("inSR", "4326");
    params.set("spatialRel", "esriSpatialRelIntersects");
    if (opts.distanceMeters != null) {
      params.set("distance", String(opts.distanceMeters));
      params.set("units", "esriSRUnit_Meter");
    }
  }

  let res: Response;
  try {
    res = await fetch(`${opts.queryUrl}?${params.toString()}`, {
      // We manage freshness ourselves via SourceCache/TTL — never let the
      // platform fetch cache masquerade stale data as fresh.
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
  } catch (e) {
    throw new ArcgisError(
      `Network error querying King County: ${(e as Error).message}`,
    );
  }

  if (!res.ok) {
    throw new ArcgisError(`King County returned HTTP ${res.status}`, res.status);
  }

  const json = (await res.json()) as ArcgisQueryResponse<A>;
  // ArcGIS returns 200 with an embedded error object on bad queries.
  if (json.error) {
    throw new ArcgisError(json.error.message, json.error.code);
  }
  return json;
}
