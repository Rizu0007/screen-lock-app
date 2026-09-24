import { NextResponse, type NextRequest } from "next/server";

/** Optimistic cookie-only pre-check plus no-store. Not the security boundary (see server/dal.ts). */
const PUBLIC_PATHS = new Set(["/login"]);

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has("session") || request.cookies.has("__Host-session");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Server Action / RSC requests go through; the DAL guards them.
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
