import { customType } from "drizzle-orm/pg-core";
import { pgTable, text, integer, doublePrecision, timestamp } from "drizzle-orm/pg-core";

/**
 * PostGIS geometry as a Drizzle custom type. Drizzle (unlike Prisma) lets us
 * declare geometry columns directly and compose spatial SQL (ST_DWithin,
 * ST_Intersects) — the reason we chose it (see /docs/DECISIONS.md).
 *
 * Phase 0: this schema is a minimal placeholder to anchor the migration setup.
 * The real parcel cache + watch state tables are designed in Slice 1+.
 * Requires the PostGIS extension: `CREATE EXTENSION IF NOT EXISTS postgis;`
 */
export const geometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Geometry, 4326)"; // WGS84
  },
});

/** Placeholder parcel cache. Fields firm up in Slice 1 against the live service. */
export const parcels = pgTable("parcels", {
  /** King County PIN. */
  parcelId: text("parcel_id").primaryKey(),
  presentUseCode: text("present_use_code"),
  zoningCode: text("zoning_code"),
  lotSqFt: integer("lot_sq_ft"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  geom: geometry("geom"),
  /** When we last fetched this from the county source. Drives provenance. */
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
});
