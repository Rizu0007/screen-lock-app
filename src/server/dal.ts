import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { readSessionToken } from "@/server/session/cookie";
import { findSessionByToken, type SessionRecord } from "@/server/session/repository";

/**
 * Data Access Layer: the single authority for "who is this request and what
 * may it do". Every protected page, Server Action and Route Handler calls one
 * of the guards below. The proxy only performs an optimistic pre-check, and
 * layouts are not re-rendered on client navigation, so neither is relied on
 * for enforcement.
 *
 *   anonymous ──login──▶ active ──lock──▶ locked ──correct PIN──▶ active
 *                          │                 │
 *                        logout     3rd wrong PIN / sign out
 *                          ▼                 ▼
 *                      anonymous (session row deleted)
 */
export type AuthState =
  | { status: "anonymous"; hadCookie: boolean }
  | { status: "locked"; session: SessionRecord }
  | { status: "active"; session: SessionRecord };

/** Memoised per request, so several guards in one render cost one query. */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const token = await readSessionToken();
  if (!token) return { status: "anonymous", hadCookie: false };

  const session = await findSessionByToken(token);
  if (!session) return { status: "anonymous", hadCookie: true };

  return session.lock ? { status: "locked", session } : { status: "active", session };
});

/** For application pages and actions: requires an authenticated, unlocked session. */
export async function requireActiveSession(): Promise<SessionRecord> {
  const state = await getAuthState();
  if (state.status === "anonymous") {
    redirect(state.hadCookie ? "/login?reason=session_expired" : "/login");
  }
  if (state.status === "locked") redirect("/lock");
  return state.session;
}

/** For the lock screen and unlock action: requires an authenticated, locked session. */
export async function requireLockedSession(): Promise<SessionRecord> {
  const state = await getAuthState();
  if (state.status === "anonymous") {
    redirect(state.hadCookie ? "/login?reason=session_expired" : "/login");
  }
  if (state.status === "active") redirect("/dashboard");
  return state.session;
}
