export const DEFAULT_AFTER_LOGIN = "/dashboard";

const ORIGIN = "http://internal.invalid";

/** Paths that must never be used as a "return to" destination. */
const BLOCKED_PREFIXES = ["/lock", "/login", "/api", "/_next"];

/**
 * Returns `value` only if it is a same-origin, in-app path; otherwise null.
 *
 * Defends against open redirects such as `//evil.com`, `/\evil.com`,
 * `/%5Cevil.com`, `/\t/evil.com` (browsers strip tab/CR/LF, turning it into
 * `//evil.com`), `javascript:` URLs and absolute URLs. Applied both when the
 * value is stored (on lock) and when it is used (on unlock).
 */
export function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Control characters, whitespace and backslashes have no business in our paths.
  if (/[\u0000-\u001f\u007f\s\\]/.test(value)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;

  let url: URL;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN) return null;

  const path = url.pathname.toLowerCase();
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

export function returnToOrDefault(value: unknown): string {
  return sanitizeReturnTo(value) ?? DEFAULT_AFTER_LOGIN;
}
