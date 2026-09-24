import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** PIN hash + failed-attempt counter, per user (Part B.1). */
export const pinCredentials = pgTable("pin_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  pinHash: text("pin_hash").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Only the SHA-256 of the cookie token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** A row means the session is locked. Kept separate from `sessions`. */
export const screenLocks = pgTable("screen_locks", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
  returnTo: text("return_to").notNull(),
});

/** Login throttle per (email, IP). */
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export const AUTH_EVENT_TYPES = [
  "login_success",
  "login_failure",
  "login_throttled",
  "logout",
  "screen_locked",
  "unlock_success",
  "unlock_failure",
  "pin_lockout",
] as const;
export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];

export const authEvents = pgTable(
  "auth_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AuthEventType>().notNull(),
    sessionId: uuid("session_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index("auth_events_user_created_idx").on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
