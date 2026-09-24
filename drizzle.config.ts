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
  // Migrations use a direct connection when available (Neon's Vercel
  // integration provides DATABASE_URL_UNPOOLED); the app uses the pooled URL.
  dbCredentials: { url: normalizeDatabaseUrl((process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)!) },
  strict: true,
});
