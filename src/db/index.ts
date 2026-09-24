import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import { normalizeDatabaseUrl } from "./connection-url";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// Reuse one pool across dev hot reloads instead of leaking a pool per reload.
const globalForDb = globalThis as unknown as { __db?: Database; __sql?: postgres.Sql };

function create(): Database {
  const config = env();
  const client = postgres(normalizeDatabaseUrl(config.DATABASE_URL), {
    // Serverless platforms run many small instances; each gets a small pool and
    // the provider's pooler (e.g. Neon's "-pooler" host) fans them in.
    max: config.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 5 : 10),
    idle_timeout: 20,
    connect_timeout: 10,
    // Transaction-mode poolers (PgBouncer) cannot keep named prepared statements.
    prepare: false,
  });
  globalForDb.__sql = client;
  return drizzle(client, { schema });
}

export function getDb(): Database {
  globalForDb.__db ??= create();
  return globalForDb.__db;
}

/** Closes the pool; used by scripts and tests. */
export async function closeDb() {
  await globalForDb.__sql?.end();
  globalForDb.__db = undefined;
  globalForDb.__sql = undefined;
}

export { schema };
