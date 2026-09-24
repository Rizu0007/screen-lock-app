/**
 * Allow-list of `?reason=` codes shown on the login page. The query value is
 * only ever used as a lookup key; it is never rendered, so the URL cannot
 * inject text into the page.
 */
export const SIGNED_OUT_MESSAGES = {
  pin_lockout: "You were signed out after 3 incorrect PIN attempts. Sign in again to continue.",
  session_expired: "Your session has expired. Please sign in again.",
  signed_out: "You have been signed out.",
} as const;

export type SignedOutReason = keyof typeof SIGNED_OUT_MESSAGES;

export function signedOutMessage(reason: unknown): string | null {
  return typeof reason === "string" && Object.hasOwn(SIGNED_OUT_MESSAGES, reason)
    ? SIGNED_OUT_MESSAGES[reason as SignedOutReason]
    : null;
}
