/**
 * Creates (or resets) the demo accounts with their pre-configured PINs.
 * Re-running restores known credentials, clears the PIN counter and signs the
 * demo users out everywhere, which also gives e2e tests a clean slate.
 *
 * Run with: npm run db:seed
 * On Vercel the build runs it with --if-enabled, which only seeds when
 * SEED_DEMO_ACCOUNTS=true (demo/assessment deployments).
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { loginAttempts, pinCredentials, sessions, users } from "@/db/schema";
import { hashSecret } from "@/server/auth/hashing";
import { DEMO_USERS } from "@/lib/demo-users";

async function main() {
  const enabled = process.env.SEED_DEMO_ACCOUNTS === "true";
  if (process.argv.includes("--if-enabled") && !enabled) {
    console.log("SEED_DEMO_ACCOUNTS is not true; skipping demo accounts.");
    return;
  }
  if (process.env.NODE_ENV === "production" && !enabled) {
    throw new Error("Refusing to seed demo accounts in production (set SEED_DEMO_ACCOUNTS=true for a demo deployment).");
  }
  const db = getDb();

  for (const demo of DEMO_USERS) {
    const passwordHash = await hashSecret(demo.password);
    const pinHash = await hashSecret(demo.pin);

    const [user] = await db
      .insert(users)
      .values({ email: demo.email, passwordHash })
      .onConflictDoUpdate({ target: users.email, set: { passwordHash } })
      .returning({ id: users.id });

    await db
      .insert(pinCredentials)
      .values({ userId: user.id, pinHash })
      .onConflictDoUpdate({
        target: pinCredentials.userId,
        set: { pinHash, failedAttempts: 0 },
      });

    await db.delete(sessions).where(eq(sessions.userId, user.id));
    console.log(`seeded ${demo.email}`);
  }

  // Login throttle keys are hashed, so clear them all in dev.
  await db.delete(loginAttempts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
