"use client";

import { useEffect } from "react";
import { broadcastAuthChange, enforceStatus, hardNavigate, loginPath, subscribeAuthChange } from "@/lib/auth-channel";

/**
 * Client-side companion to the server guards, mounted on every protected page.
 * It never grants access; it only removes already-rendered content from view
 * when the session changes underneath this tab:
 *  - another tab locked / signed out  -> BroadcastChannel hint, then re-check
 *  - locked from another device, or the session expired -> re-check on focus
 *  - page restored from the back/forward cache -> force a fresh server render
 *
 * Mounting also announces "active" to other tabs, so a tab sitting on the lock
 * screen follows as soon as this one is unlocked.
 */
export function SessionGuard() {
  useEffect(() => {
    const recheck = () =>
      enforceStatus("active", (status) => hardNavigate(status === "locked" ? "/lock" : loginPath("session_expired")));

    broadcastAuthChange();
    const unsubscribe = subscribeAuthChange(recheck);

    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
