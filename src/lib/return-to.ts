export const DEFAULT_AFTER_LOGIN = "/dashboard";

const ORIGIN = "http://internal.invalid";

const BLOCKED_PREFIXES = ["/lock", "/login", "/api", "/_next"];

/** Same-origin in-app path, or null. Rejects //, \, control characters and encoded variants. */
export function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
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
