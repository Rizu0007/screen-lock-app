import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// Reuse one pool across dev hot reloads instead of leaking a pool per reload.
const globalForDb = globalThis as unknown as { __db?: Database; __sql?: postgres.Sql };

function create(): Database {
  const client = postgres(env().DATABASE_URL, { max: 10 });
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
