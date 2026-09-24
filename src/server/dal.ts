import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { readSessionToken } from "@/server/session/cookie";
import { findSessionByToken, type SessionRecord } from "@/server/session/repository";

/**
 * The security boundary: every page, Server Action and Route Handler calls
 * these guards. The proxy is only an optimistic pre-check.
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

export async function requireActiveSession(): Promise<SessionRecord> {
  const state = await getAuthState();
  if (state.status === "anonymous") {
    redirect(state.hadCookie ? "/login?reason=session_expired" : "/login");
  }
  if (state.status === "locked") redirect("/lock");
  return state.session;
}

export async function requireLockedSession(): Promise<SessionRecord> {
  const state = await getAuthState();
  if (state.status === "anonymous") {
    redirect(state.hadCookie ? "/login?reason=session_expired" : "/login");
  }
  if (state.status === "active") redirect("/dashboard");
  return state.session;
}
