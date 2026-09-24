import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic, cookie-only pre-check (no database access), as recommended for
 * Next.js Proxy. It is NOT the security boundary: every page, Server Action
 * and Route Handler re-validates the session through the DAL
 * (src/server/dal.ts), so a proxy bypass cannot expose locked content.
 *
 * Responsibilities:
 *  1. Send visitors without any session cookie straight to /login.
 *  2. Mark every response as non-cacheable so protected pages are not served
 *     from the HTTP cache after a lock or sign-out.
 */
const PUBLIC_PATHS = new Set(["/login"]);

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has("session") || request.cookies.has("__Host-session");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Server Action and RSC requests must reach the app so it can answer in the
  // format the client router expects; the DAL guards them.
  const isFrameworkRequest = request.headers.has("next-action") || request.headers.has("rsc");
  const isPageRequest = request.method === "GET" && !pathname.startsWith("/api/");

  if (isPageRequest && !isFrameworkRequest && !PUBLIC_PATHS.has(pathname) && !hasSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
