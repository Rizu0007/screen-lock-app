"use client";

import type { SignedOutReason } from "@/lib/login-reasons";
import { fetchSessionStatus, type SessionStatus } from "@/lib/session-status";

/** Cross-tab "session changed" hints with no data; each tab re-checks with the server. */
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

/** Full navigation; also clears Next's client router cache. */
export function hardNavigate(path: string) {
  window.location.replace(path);
}

export function loginPath(reason: SignedOutReason) {
  return `/login?reason=${reason}`;
}

export async function enforceStatus(allowed: SessionStatus, onMismatch: (status: SessionStatus) => void) {
  const status = await fetchSessionStatus();
  if (status && status !== allowed) onMismatch(status);
}
