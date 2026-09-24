import "server-only";
import { cookies } from "next/headers";
import { isProduction } from "@/server/env";

/** `__Host-` prefix in production (forces Secure, Path=/, no Domain). */
export function sessionCookieName(): string {
  return isProduction() ? "__Host-session" : "session";
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete({ name: sessionCookieName(), path: "/" });
}
