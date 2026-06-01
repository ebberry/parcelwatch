/**
 * Map / geospatial abstraction layer (see /docs/maps.md).
 *
 * The heavy ArcGIS Maps SDK for JavaScript is reserved for CLIENT-SIDE map
 * rendering only. All server-side geospatial work — geocoding, parcel
 * point-queries, radius queries — goes through this interface and is backed by
 * keyless REST against King County's hosted feature services where possible.
 * This keeps the bundle small, limits Esri credit burn, and makes adapters
 * testable without a browser. We can swap to MapLibre + a free tile source
 * later without touching callers.
 *
 * Phase 0 defines the interface only; implementations land in Slice 1.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface GeocodeResult {
  point: LatLon;
  matchedAddress: string;
  /** 0..1 confidence from the geocoder, if provided. */
  score?: number;
}

export interface MapProvider {
  /** Address string -> coordinates. */
  geocode(address: string): Promise<GeocodeResult[]>;
  /** Identify the parcel containing a point (county feature service query). */
  parcelAtPoint(point: LatLon): Promise<{ parcelId: string } | null>;
}
