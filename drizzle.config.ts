import { defineConfig } from "drizzle-kit";
import { normalizeDatabaseUrl } from "./src/db/connection-url";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the real environment (CI, containers).
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations prefer the direct (unpooled) connection.
  dbCredentials: { url: normalizeDatabaseUrl((process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)!) },
  strict: true,
});
