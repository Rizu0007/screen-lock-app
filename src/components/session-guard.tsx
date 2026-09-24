"use client";

import { useEffect } from "react";
import { broadcastAuthChange, enforceStatus, hardNavigate, loginPath, subscribeAuthChange } from "@/lib/auth-channel";

/**
 * Never grants access. Leaves protected pages when the session changes
 * elsewhere: other tab (BroadcastChannel), focus re-check, bfcache restore.
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
