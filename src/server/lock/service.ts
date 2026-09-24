import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pinCredentials, screenLocks, sessions } from "@/db/schema";
import { MAX_PIN_ATTEMPTS } from "@/lib/validation";
import { returnToOrDefault } from "@/lib/return-to";
import { verifySecret } from "@/server/auth/hashing";
import { deleteAllUserSessions, rotateSessionToken } from "@/server/session/repository";

/**
 * Locks an active session. Idempotent: locking an already-locked session keeps
 * the original return path. The session token is NOT rotated here (it is on
 * unlock): changing the cookie inside the lock action would make Next re-render
 * and soft-navigate the current page, racing the client's hard navigation.
 */
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
  /** Unlocked concurrently (e.g. another tab); the session is still valid. */
  | { status: "already_unlocked" }
  /** Session expired or was destroyed concurrently (e.g. lockout in another tab). */
  | { status: "session_gone" }
  | { status: "no_pin_configured" };

/**
 * Verifies a PIN for a locked session.
 *
 * Concurrency: the user's `pin_credentials` row is locked with SELECT ... FOR
 * UPDATE for the whole check-and-write, so parallel attempts (multiple tabs,
 * devices, or a scripted burst) are strictly serialised. A burst of N wrong
 * PINs therefore consumes exactly N attempts and can never exceed the limit,
 * and a correct PIN racing a wrong one cannot resurrect a deleted session.
 *
 * Counter semantics (per user, brief Part B):
 *  - wrong PIN   -> failed_attempts + 1
 *  - 3rd wrong   -> every session of the user is deleted, counter reset to 0
 *  - correct PIN -> counter reset to 0, lock removed, token rotated
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

    // Re-check under the row lock: a concurrent request may have unlocked or
    // destroyed this session while we were waiting.
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

/** A successful full-credential login proves identity, so the PIN budget starts over. */
export async function resetFailedPinAttempts(userId: string) {
  await getDb()
    .update(pinCredentials)
    .set({ failedAttempts: 0, updatedAt: sql`now()` })
    .where(eq(pinCredentials.userId, userId));
}
