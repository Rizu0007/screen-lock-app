"use client";

export type SessionStatus = "active" | "locked" | "anonymous";

/** Asks the server for the current session state; null on network failure. */
export async function fetchSessionStatus(): Promise<SessionStatus | null> {
  try {
    const res = await fetch("/api/session/status", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: SessionStatus };
    return body.status ?? null;
  } catch {
    return null;
  }
}
