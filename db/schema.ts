import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Watch persistence (Slice 5). Plain Postgres — no PostGIS needed (the watches
 * we can build are topic/legislation monitors, not geospatial; the geospatial
 * permit watch has no API and is deferred). PostGIS is added when a feature
 * actually needs it. See /docs/DECISIONS.md.
 */

/** A user's subscription: monitor a kind + topics, optionally scoped to a parcel. */
export const watches = pgTable("watches", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  /** Null = jurisdiction-wide (not tied to one parcel). */
  parcelId: text("parcel_id"),
  kind: text("kind").notNull(), // 'council' | 'legislature'
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  digestFrequency: text("digest_frequency").notNull().default("weekly"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Source items we've already processed — so we only alert on genuinely new ones. */
export const watchSeen = pgTable(
  "watch_seen",
  {
    kind: text("kind").notNull(),
    externalId: text("external_id").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: uniqueIndex("watch_seen_pk").on(t.kind, t.externalId) }),
);

/** Generated alerts — the in-app feed. */
export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    parcelId: text("parcel_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    url: text("url"),
    source: text("source").notNull(),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => ({ byUser: index("alerts_user_idx").on(t.userId, t.createdAt) }),
);
