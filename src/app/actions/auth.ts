"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validation";
import { recordAuthEvent } from "@/server/audit";
import { verifyCredentials } from "@/server/auth/credentials";
import {
  clearLoginAttempts,
  consumeLoginAttempt,
  LOGIN_WINDOW_MINUTES,
  loginThrottleKey,
} from "@/server/auth/rate-limit";
import { getAuthState } from "@/server/dal";
import { resetFailedPinAttempts } from "@/server/lock/service";
import { getRequestContext } from "@/server/request-context";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/server/session/cookie";
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  deleteSessionByToken,
} from "@/server/session/repository";

export type LoginState = { error?: string; email?: string };

const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const rawEmail = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_LOGIN_ERROR, email: rawEmail };
  }
  const { email, password } = parsed.data;

  const { ip } = await getRequestContext();
  const throttleKey = loginThrottleKey(email, ip);
  const { allowed } = await consumeLoginAttempt(throttleKey);
  if (!allowed) {
    await recordAuthEvent({ type: "login_throttled" });
    return {
      error: `Too many sign-in attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes.`,
      email,
    };
  }

  const result = await verifyCredentials(email, password);
  if (!result.ok) {
    await recordAuthEvent({ type: "login_failure", userId: result.userId });
    return { error: GENERIC_LOGIN_ERROR, email };
  }

  // Session fixation: never reuse a session presented before authentication.
  const previousToken = await readSessionToken();
  if (previousToken) await deleteSessionByToken(previousToken);

  const { token, sessionId, expiresAt } = await createSession(result.userId);
  await setSessionCookie(token, expiresAt);

  await Promise.all([
    resetFailedPinAttempts(result.userId),
    clearLoginAttempts(throttleKey),
    deleteExpiredSessions(),
    recordAuthEvent({ type: "login_success", userId: result.userId, sessionId }),
  ]);

  redirect("/dashboard");
}

/**
 * Ends the current session. Allowed from both the active and the locked
 * state ("Sign out" on the lock screen). Other tabs are notified by the login
 * page once it renders.
 */
export async function logoutAction(): Promise<never> {
  const state = await getAuthState();
  if (state.status !== "anonymous") {
    await deleteSession(state.session.sessionId);
    await recordAuthEvent({
      type: "logout",
      userId: state.session.userId,
      sessionId: state.session.sessionId,
    });
  }
  await clearSessionCookie();
  redirect("/login?reason=signed_out");
}
