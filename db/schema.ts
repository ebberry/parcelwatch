import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

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
  // 'council' | 'legislature' (jurisdiction-wide feed) | 'assessment' | 'sales'
  // (parcel-scoped state diff).
  kind: text("kind").notNull(),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  digestFrequency: text("digest_frequency").notNull().default("weekly"),
  active: boolean("active").notNull().default(true),
  /**
   * Per-watch baseline for parcel-scoped kinds: the last-observed state we diff
   * against (e.g. last assessed value, or the set of sale keys already seen).
   * Null until the first poll seeds it. Unused by jurisdiction-wide kinds.
   */
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
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

/**
 * Cached AI enrichments (Claude) — keyed by (source item, AREA). Relevance is
 * area-specific (a Seattle ordinance matters to a Seattle parcel, not a Vashon
 * one), so the same item can have one insight per area. The content hash lets us
 * re-summarize only when the item text changes. Worker writes, request reads.
 */
export const aiSummaries = pgTable(
  "ai_summaries",
  {
    externalId: text("external_id").notNull(),
    areaKey: text("area_key").notNull(),
    kind: text("kind").notNull(),
    contentHash: text("content_hash").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.externalId, t.areaKey] }) }),
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

/**
 * Auth.js (NextAuth v5) tables for the @auth/drizzle-adapter. Magic-link email
 * sign-in uses the user, account, session, and verificationToken tables.
 */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);
