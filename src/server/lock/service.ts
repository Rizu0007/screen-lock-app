import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pinCredentials, screenLocks, sessions } from "@/db/schema";
import { MAX_PIN_ATTEMPTS } from "@/lib/validation";
import { returnToOrDefault } from "@/lib/return-to";
import { verifySecret } from "@/server/auth/hashing";
import { deleteAllUserSessions, rotateSessionToken } from "@/server/session/repository";

// Idempotent. No token rotation here: a cookie change would re-render the page and race the client's hard navigation.
export async function lockSession(sessionId: string, requestedReturnTo: unknown) {
  const returnTo = returnToOrDefault(requestedReturnTo);
  await getDb()
    .insert(screenLocks)
    .values({ sessionId, returnTo })
    .onConflictDoNothing({ target: screenLocks.sessionId });
  return { returnTo };
}

export type UnlockResult =
  | { status: "unlocked"; returnTo: string; token: string; expiresAt: Date }
  | { status: "invalid"; attemptsRemaining: number }
  | { status: "locked_out" }
  | { status: "already_unlocked" }
  | { status: "session_gone" }
  | { status: "no_pin_configured" };

/**
 * One transaction per attempt. FOR UPDATE on the user's PIN row serialises
 * parallel attempts, so the 3-attempt limit cannot be exceeded.
 */
export async function attemptUnlock(
  sessionId: string,
  userId: string,
  pin: string,
): Promise<UnlockResult> {
  return getDb().transaction(async (tx) => {
    const [credential] = await tx
      .select()
      .from(pinCredentials)
      .where(eq(pinCredentials.userId, userId))
      .for("update");
    if (!credential) return { status: "no_pin_configured" };

    // Re-check under the lock: another request may have unlocked or ended the session.
    const [current] = await tx
      .select({ returnTo: screenLocks.returnTo })
      .from(sessions)
      .leftJoin(screenLocks, eq(screenLocks.sessionId, sessions.id))
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, sql`now()`)));
    if (!current) return { status: "session_gone" };
    if (current.returnTo === null) return { status: "already_unlocked" };
    const lock = { returnTo: current.returnTo };

    const valid = await verifySecret(credential.pinHash, pin);

    if (valid) {
      await tx
        .update(pinCredentials)
        .set({ failedAttempts: 0, updatedAt: sql`now()` })
        .where(eq(pinCredentials.userId, userId));
      await tx.delete(screenLocks).where(eq(screenLocks.sessionId, sessionId));
      const rotated = await rotateSessionToken(sessionId, tx);
      if (!rotated) return { status: "session_gone" };
      return { status: "unlocked", returnTo: returnToOrDefault(lock.returnTo), ...rotated };
    }

    const failed = credential.failedAttempts + 1;
    if (failed >= MAX_PIN_ATTEMPTS) {
      await tx
        .update(pinCredentials)
        .set({ failedAttempts: 0, updatedAt: sql`now()` })
        .where(eq(pinCredentials.userId, userId));
      await deleteAllUserSessions(userId, tx);
      return { status: "locked_out" };
    }

    await tx
      .update(pinCredentials)
      .set({ failedAttempts: failed, updatedAt: sql`now()` })
      .where(eq(pinCredentials.userId, userId));
    return { status: "invalid", attemptsRemaining: MAX_PIN_ATTEMPTS - failed };
  });
}

export async function getFailedPinAttempts(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ failedAttempts: pinCredentials.failedAttempts })
    .from(pinCredentials)
    .where(eq(pinCredentials.userId, userId));
  return row?.failedAttempts ?? 0;
}

/** Called after a successful password login. */
export async function resetFailedPinAttempts(userId: string) {
  await getDb()
    .update(pinCredentials)
    .set({ failedAttempts: 0, updatedAt: sql`now()` })
    .where(eq(pinCredentials.userId, userId));
}
