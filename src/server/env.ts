import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  AUTH_PEPPER: z
    .string()
    .min(32, "AUTH_PEPPER must be at least 32 characters (openssl rand -base64 48)"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Max Postgres connections per server instance. Keep small on serverless. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
  /** Demo deployments only: seed demo users and show their logins. */
  SEED_DEMO_ACCOUNTS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated once; invalid config fails fast. */
export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

export const demoAccountsVisible = () => !isProduction() || env().SEED_DEMO_ACCOUNTS;
