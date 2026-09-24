import "server-only";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { screenLocks, sessions, users } from "@/db/schema";
import { generateToken, sha256 } from "@/server/auth/hashing";

/** Absolute session lifetime. Locking does not extend it. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;

export type SessionRecord = {
  sessionId: string;
  userId: string;
  email: string;
  expiresAt: Date;
  lock: { lockedAt: Date; returnTo: string } | null;
};

export async function createSession(userId: string, db: Executor = getDb()) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await db
    .insert(sessions)
    .values({ tokenHash: sha256(token), userId, expiresAt })
    .returning({ id: sessions.id });
  return { token, sessionId: row.id, expiresAt };
}

export async function findSessionByToken(token: string): Promise<SessionRecord | null> {
  const [row] = await getDb()
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      email: users.email,
      expiresAt: sessions.expiresAt,
      lockedAt: screenLocks.lockedAt,
      returnTo: screenLocks.returnTo,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(screenLocks, eq(screenLocks.sessionId, sessions.id))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);

  if (!row) return null;
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    email: row.email,
    expiresAt: row.expiresAt,
    lock: row.lockedAt && row.returnTo ? { lockedAt: row.lockedAt, returnTo: row.returnTo } : null,
  };
}

/** New token, same session. Used on unlock so earlier cookie copies stop working. */
export async function rotateSessionToken(sessionId: string, db: Executor = getDb()) {
  const token = generateToken();
  const [row] = await db
    .update(sessions)
    .set({ tokenHash: sha256(token) })
    .where(eq(sessions.id, sessionId))
    .returning({ expiresAt: sessions.expiresAt });
  return row ? { token, expiresAt: row.expiresAt } : null;
}

export async function deleteSession(sessionId: string, db: Executor = getDb()) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteSessionByToken(token: string, db: Executor = getDb()) {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function deleteAllUserSessions(userId: string, db: Executor = getDb()) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function deleteExpiredSessions(db: Executor = getDb()) {
  await db.delete(sessions).where(lte(sessions.expiresAt, sql`now()`));
}
