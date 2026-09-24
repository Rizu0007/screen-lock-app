"use client";

import { useEffect } from "react";
import { broadcastAuthChange, enforceStatus, subscribeAuthChange } from "@/lib/auth-channel";

/** Reloads once the session is no longer locked; the server decides where to go. */
export function LockScreenGuard() {
  useEffect(() => {
    const recheck = () => enforceStatus("locked", () => window.location.reload());

    broadcastAuthChange();
    const unsubscribe = subscribeAuthChange(recheck);

    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
