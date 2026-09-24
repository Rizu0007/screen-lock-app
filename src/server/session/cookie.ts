import "server-only";
import { cookies } from "next/headers";
import { isProduction } from "@/server/env";

/**
 * In production the `__Host-` prefix makes the browser enforce Secure, Path=/
 * and no Domain attribute, so the cookie cannot be set or shadowed by a
 * sibling subdomain. Plain http://localhost cannot use it (WebKit drops
 * Secure cookies over http), hence the dev name.
 */
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
