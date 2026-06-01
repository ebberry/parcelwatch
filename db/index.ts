import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy singleton so importing this module doesn't require a live DB connection
 * (Phase 0 runs without Postgres). Callers in Slice 1+ use getDb().
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and start the DB (docker compose up db).",
      );
    }
    const client = postgres(url, { max: 10 });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export { schema };
