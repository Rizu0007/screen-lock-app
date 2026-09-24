"use client";

import { sanitizeReturnTo } from "@/lib/return-to";
import type { SignedOutReason } from "@/lib/login-reasons";

/**
 * Cross-tab notifications (same browser, same origin). Tabs share the session
 * cookie, so when one tab locks, unlocks or signs out, the others must follow
 * immediately instead of continuing to display protected content.
 * The server remains the authority; these messages only trigger navigation.
 */
export type AuthMessage =
  | { type: "locked" }
  | { type: "unlocked"; returnTo: string }
  | { type: "signed_out"; reason: SignedOutReason };

const CHANNEL = "screen-lock-auth";

export function broadcastAuth(message: AuthMessage) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(message);
  channel.close();
}

export function subscribeAuth(handler: (message: AuthMessage) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<AuthMessage>) => handler(event.data);
  return () => channel.close();
}

/**
 * Full-document navigation that replaces the current history entry. A hard
 * navigation also discards Next's in-memory router cache, so previously
 * rendered protected pages cannot be restored client-side.
 */
export function hardNavigate(path: string) {
  window.location.replace(path);
}

export function loginPath(reason: SignedOutReason) {
  return `/login?reason=${reason}`;
}

export function safeReturnPath(value: unknown) {
  return sanitizeReturnTo(value) ?? "/dashboard";
}
