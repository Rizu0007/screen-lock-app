"use client";

import { useEffect } from "react";
import { hardNavigate, loginPath, safeReturnPath, subscribeAuth } from "@/lib/auth-channel";
import { fetchSessionStatus } from "@/lib/session-status";

/**
 * Keeps a lock screen in sync with the other tabs of the same session: if
 * another tab unlocks, follow it back into the app; if the session ends
 * elsewhere, go to the login page.
 */
export function LockScreenGuard() {
  useEffect(() => {
    const unsubscribe = subscribeAuth((message) => {
      if (message.type === "unlocked") hardNavigate(safeReturnPath(message.returnTo));
      if (message.type === "signed_out") hardNavigate(loginPath(message.reason));
    });

    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      const status = await fetchSessionStatus();
      if (status === "active") hardNavigate("/dashboard");
      if (status === "anonymous") hardNavigate(loginPath("session_expired"));
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
