/**
 * Creates (or resets) the demo accounts with their pre-configured PINs.
 * Re-running restores known credentials, clears the PIN counter and signs the
 * demo users out everywhere, which also gives e2e tests a clean slate.
 *
 * Run with: npm run db:seed
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { loginAttempts, pinCredentials, sessions, users } from "@/db/schema";
import { hashSecret } from "@/server/auth/hashing";
import { DEMO_USERS } from "@/lib/demo-users";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo accounts in production.");
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
