"use client";

import type { SignedOutReason } from "@/lib/login-reasons";
import { fetchSessionStatus, type SessionStatus } from "@/lib/session-status";

/**
 * Cross-tab notifications (same browser, same origin). Tabs share the session
 * cookie, so when one tab locks, unlocks or signs out, the others must follow
 * immediately instead of continuing to display protected content.
 *
 * Messages carry no data: they only tell other tabs "the session changed,
 * ask the server". The server stays the single source of truth.
 */
const CHANNEL = "screen-lock-auth";

export function broadcastAuthChange() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage("changed");
  channel.close();
}

export function subscribeAuthChange(handler: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => handler();
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

/**
 * Re-checks the session with the server and leaves the current page if it no
 * longer matches the state this page is allowed to show.
 */
export async function enforceStatus(allowed: SessionStatus, onMismatch: (status: SessionStatus) => void) {
  const status = await fetchSessionStatus();
  if (status && status !== allowed) onMismatch(status);
}
