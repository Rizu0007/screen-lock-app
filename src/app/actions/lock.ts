"use server";

import { redirect } from "next/navigation";
import { MAX_PIN_ATTEMPTS, pinSchema } from "@/lib/validation";
import type { SignedOutReason } from "@/lib/login-reasons";
import { recordAuthEvent } from "@/server/audit";
import { getAuthState } from "@/server/dal";
import { attemptUnlock, lockSession } from "@/server/lock/service";
import { clearSessionCookie, setSessionCookie } from "@/server/session/cookie";

export type LockResult = { ok: true } | { ok: false; reason: SignedOutReason };

/**
 * Locks the current session. `returnTo` comes from the browser
 * (pathname + search + hash) and is validated server-side; an invalid value
 * falls back to the dashboard rather than failing the lock.
 */
export async function lockAction(returnTo: string): Promise<LockResult> {
  const state = await getAuthState();
  if (state.status === "anonymous") return { ok: false, reason: "session_expired" };
  if (state.status === "locked") return { ok: true };

  const { sessionId, userId } = state.session;
  await lockSession(sessionId, returnTo);
  await recordAuthEvent({ type: "screen_locked", userId, sessionId });
  return { ok: true };
}

/**
 * Only non-terminal outcomes are returned to the form. Success and sign-out
 * redirect on the server: an action that changes cookies makes Next re-render
 * the current route, so a server redirect is the only navigation that cannot
 * be overtaken by that re-render.
 */
export type UnlockState =
  | { status: "idle"; attemptsRemaining: number }
  | { status: "error"; message: string; attemptsRemaining: number }
  | { status: "invalid"; message: string; attemptsRemaining: number };

const loginPath = (reason: SignedOutReason) => `/login?reason=${reason}`;

const attemptsMessage = (remaining: number) =>
  `Incorrect PIN. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining before you are signed out.`;

export async function unlockAction(prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const remainingBefore = prev.attemptsRemaining ?? MAX_PIN_ATTEMPTS;

  // Input validation does not consume an attempt: only a well-formed PIN that
  // fails verification counts as an unsuccessful attempt.
  const parsed = pinSchema.safeParse(formData.get("pin"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "PIN must be exactly 6 digits.",
      attemptsRemaining: remainingBefore,
    };
  }

  const state = await getAuthState();
  if (state.status === "anonymous") redirect(loginPath("session_expired"));
  if (state.status === "active") redirect("/dashboard");

  const { sessionId, userId } = state.session;
  const result = await attemptUnlock(sessionId, userId, parsed.data);

  switch (result.status) {
    case "unlocked":
      await setSessionCookie(result.token, result.expiresAt);
      await recordAuthEvent({ type: "unlock_success", userId, sessionId });
      redirect(result.returnTo);

    case "invalid":
      await recordAuthEvent({
        type: "unlock_failure",
        userId,
        sessionId,
        detail: `${MAX_PIN_ATTEMPTS - result.attemptsRemaining}/${MAX_PIN_ATTEMPTS}`,
      });
      return {
        status: "invalid",
        message: attemptsMessage(result.attemptsRemaining),
        attemptsRemaining: result.attemptsRemaining,
      };

    case "locked_out":
      await clearSessionCookie();
      await recordAuthEvent({ type: "pin_lockout", userId, sessionId });
      redirect(loginPath("pin_lockout"));

    case "already_unlocked":
      redirect("/dashboard");

    case "session_gone":
      await clearSessionCookie();
      redirect(loginPath("session_expired"));

    case "no_pin_configured":
      return {
        status: "error",
        message: "No screen-lock PIN is configured for this account. Sign out and contact support.",
        attemptsRemaining: remainingBefore,
      };
  }
}
