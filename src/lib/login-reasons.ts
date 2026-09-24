/** Allow-listed ?reason= codes; the query value is only a lookup key, never rendered. */
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
