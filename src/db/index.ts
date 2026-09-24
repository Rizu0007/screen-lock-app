import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import { normalizeDatabaseUrl } from "./connection-url";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// One pool per process (survives dev hot reload).
const globalForDb = globalThis as unknown as { __db?: Database; __sql?: postgres.Sql };

function create(): Database {
  const config = env();
  const client = postgres(normalizeDatabaseUrl(config.DATABASE_URL), {
    // Small pool per serverless instance; the provider's pooler fans in.
    max: config.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 5 : 10),
    idle_timeout: 20,
    connect_timeout: 10,
    // Required by transaction-mode poolers (PgBouncer).
    prepare: false,
  });
  globalForDb.__sql = client;
  return drizzle(client, { schema });
}

export function getDb(): Database {
  globalForDb.__db ??= create();
  return globalForDb.__db;
}

/** For scripts and tests. */
export async function closeDb() {
  await globalForDb.__sql?.end();
  globalForDb.__db = undefined;
  globalForDb.__sql = undefined;
}

export { schema };
