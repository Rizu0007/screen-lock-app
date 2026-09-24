import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";
import { sha256 } from "@/server/auth/hashing";

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MINUTES = 15;

/** Keyed by (email, IP) so one attacker cannot lock a victim out from everywhere. */
export function loginThrottleKey(email: string, ip: string): string {
  return sha256(`${email.toLowerCase()}|${ip}`);
}

/**
 * Atomically records an attempt and reports whether it is allowed. Counting
 * happens BEFORE the password check, so parallel requests cannot slip past
 * the limit. A successful login clears the key.
 */
export async function consumeLoginAttempt(key: string) {
  const expired = sql`${loginAttempts.windowStart} < now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})`;
  const [row] = await getDb()
    .insert(loginAttempts)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${expired} then 1 else ${loginAttempts.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${loginAttempts.windowStart} end`,
      },
    })
    .returning({ count: loginAttempts.count });
  return { allowed: row.count <= LOGIN_MAX_ATTEMPTS };
}

export async function clearLoginAttempts(key: string) {
  await getDb().delete(loginAttempts).where(eq(loginAttempts.key, key));
}
