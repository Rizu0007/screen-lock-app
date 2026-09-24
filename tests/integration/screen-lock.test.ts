/**
 * Integration tests against the real Postgres (docker compose). They exercise
 * the SQL itself (row locking, cascades, atomic counters), which mocks cannot.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { pinCredentials, screenLocks, sessions, users } from "@/db/schema";
import { hashSecret, verifySecret } from "@/server/auth/hashing";
import { consumeLoginAttempt, LOGIN_MAX_ATTEMPTS } from "@/server/auth/rate-limit";
import { attemptUnlock, getFailedPinAttempts, lockSession, resetFailedPinAttempts } from "@/server/lock/service";
import { createSession, findSessionByToken } from "@/server/session/repository";

const PIN = "482915";
const WRONG = "000000";
const createdUsers: string[] = [];

async function createUser() {
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ email: `test-${randomUUID()}@example.test`, passwordHash: await hashSecret("irrelevant") })
    .returning({ id: users.id });
  await db.insert(pinCredentials).values({ userId: user.id, pinHash: await hashSecret(PIN) });
  createdUsers.push(user.id);
  return user.id;
}

async function lockedSession(userId: string, returnTo = "/projects?page=2#x") {
  const session = await createSession(userId);
  const locked = await lockSession(session.sessionId, returnTo);
  return { ...session, token: locked!.token };
}

async function sessionCount(userId: string) {
  return (await getDb().select().from(sessions).where(eq(sessions.userId, userId))).length;
}

afterAll(async () => {
  if (createdUsers.length) await getDb().delete(users).where(inArray(users.id, createdUsers));
  await closeDb();
});

describe("hashing", () => {
  it("verifies with the pepper and stores a versioned Argon2id hash", async () => {
    const stored = await hashSecret(PIN);
    expect(stored).toMatch(/^p1\$\$argon2id\$/);
    expect(await verifySecret(stored, PIN)).toBe(true);
    expect(await verifySecret(stored, WRONG)).toBe(false);
  });

  it("treats malformed or unknown-version hashes as non-matching", async () => {
    expect(await verifySecret("garbage", PIN)).toBe(false);
    expect(await verifySecret("p9$whatever", PIN)).toBe(false);
  });
});

describe("lock / unlock", () => {
  let userId: string;
  beforeEach(async () => {
    userId = await createUser();
  });

  it("locking rotates the token and records the return path", async () => {
    const session = await createSession(userId);
    const locked = await lockSession(session.sessionId, "/projects?page=3#top");
    expect(locked!.token).not.toBe(session.token);
    expect(await findSessionByToken(session.token)).toBeNull();
    const current = await findSessionByToken(locked!.token);
    expect(current?.lock?.returnTo).toBe("/projects?page=3#top");
  });

  it("stores a safe default when the return path is malicious", async () => {
    const session = await createSession(userId);
    const locked = await lockSession(session.sessionId, "//evil.com");
    expect(locked!.returnTo).toBe("/dashboard");
  });

  it("correct PIN unlocks, returns to the saved page and keeps the same session", async () => {
    const s = await lockedSession(userId);
    const result = await attemptUnlock(s.sessionId, userId, PIN);
    expect(result).toMatchObject({ status: "unlocked", returnTo: "/projects?page=2#x" });
    const [lock] = await getDb().select().from(screenLocks).where(eq(screenLocks.sessionId, s.sessionId));
    expect(lock).toBeUndefined();
    const current = await findSessionByToken((result as { token: string }).token);
    expect(current?.sessionId).toBe(s.sessionId);
    expect(current?.lock).toBeNull();
  });

  it("counts wrong PINs and signs out every session on the third", async () => {
    const s = await lockedSession(userId);
    await createSession(userId); // a second device
    expect(await attemptUnlock(s.sessionId, userId, WRONG)).toEqual({ status: "invalid", attemptsRemaining: 2 });
    expect(await attemptUnlock(s.sessionId, userId, WRONG)).toEqual({ status: "invalid", attemptsRemaining: 1 });
    expect(await attemptUnlock(s.sessionId, userId, WRONG)).toEqual({ status: "locked_out" });
    expect(await sessionCount(userId)).toBe(0);
    expect(await getFailedPinAttempts(userId)).toBe(0);
  });

  it("a correct PIN before the third failure resets the counter", async () => {
    const s = await lockedSession(userId);
    await attemptUnlock(s.sessionId, userId, WRONG);
    await attemptUnlock(s.sessionId, userId, WRONG);
    expect((await attemptUnlock(s.sessionId, userId, PIN)).status).toBe("unlocked");
    expect(await getFailedPinAttempts(userId)).toBe(0);

    await lockSession(s.sessionId, "/dashboard");
    expect(await attemptUnlock(s.sessionId, userId, WRONG)).toEqual({ status: "invalid", attemptsRemaining: 2 });
  });

  it("counts attempts per user across sessions (not per session)", async () => {
    const a = await lockedSession(userId);
    const b = await lockedSession(userId);
    await attemptUnlock(a.sessionId, userId, WRONG);
    await attemptUnlock(b.sessionId, userId, WRONG);
    expect(await attemptUnlock(a.sessionId, userId, WRONG)).toEqual({ status: "locked_out" });
    expect(await sessionCount(userId)).toBe(0);
  });

  it("a burst of parallel wrong PINs cannot exceed the limit", async () => {
    const s = await lockedSession(userId);
    const results = await Promise.all(Array.from({ length: 8 }, () => attemptUnlock(s.sessionId, userId, WRONG)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((x) => x === "invalid")).toHaveLength(2);
    expect(statuses.filter((x) => x === "locked_out")).toHaveLength(1);
    expect(statuses.filter((x) => x === "session_gone")).toHaveLength(5);
    expect(await sessionCount(userId)).toBe(0);
  });

  it("a correct PIN racing the lockout cannot revive a deleted session", async () => {
    const s = await lockedSession(userId);
    await attemptUnlock(s.sessionId, userId, WRONG);
    await attemptUnlock(s.sessionId, userId, WRONG);
    const results = await Promise.all([
      attemptUnlock(s.sessionId, userId, WRONG),
      attemptUnlock(s.sessionId, userId, PIN),
    ]);
    const statuses = results.map((r) => r.status).sort();
    // Serialised: either the wrong PIN wins (lockout, then the PIN finds no session)
    // or the correct PIN wins (unlock, then the wrong PIN finds it already unlocked).
    expect([
      ["locked_out", "session_gone"],
      ["already_unlocked", "unlocked"],
    ]).toContainEqual(statuses);
    if (statuses.includes("locked_out")) expect(await sessionCount(userId)).toBe(0);
  });

  it("an expired session cannot be unlocked", async () => {
    const s = await lockedSession(userId);
    await getDb().update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, s.sessionId));
    expect((await attemptUnlock(s.sessionId, userId, PIN)).status).toBe("session_gone");
    expect(await findSessionByToken(s.token)).toBeNull();
  });

  it("password login resets the PIN counter", async () => {
    const s = await lockedSession(userId);
    await attemptUnlock(s.sessionId, userId, WRONG);
    await resetFailedPinAttempts(userId);
    expect(await getFailedPinAttempts(userId)).toBe(0);
  });
});

describe("login throttle", () => {
  it("allows the limit and blocks after, even when requests race", async () => {
    const key = `test-${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: LOGIN_MAX_ATTEMPTS + 3 }, () => consumeLoginAttempt(key)));
    expect(results.filter((r) => r.allowed)).toHaveLength(LOGIN_MAX_ATTEMPTS);
  });
});
