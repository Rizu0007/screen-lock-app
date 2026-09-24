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
  /**
   * Assessment/demo deployments only: seed the demo accounts on build and show
   * their credentials on the login page. Never enable for real users.
   */
  SEED_DEMO_ACCOUNTS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated server configuration. Throws on first use if a required secret is
 * missing, so a misconfigured deployment fails fast instead of running with
 * a weak or empty pepper.
 */
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

/** Demo credentials are shown in development, or when explicitly enabled for a demo deployment. */
export const demoAccountsVisible = () => !isProduction() || env().SEED_DEMO_ACCOUNTS;
