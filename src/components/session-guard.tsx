"use client";

import { useEffect } from "react";
import { hardNavigate, loginPath, subscribeAuth } from "@/lib/auth-channel";
import { fetchSessionStatus } from "@/lib/session-status";

/**
 * Client-side companion to the server guards, mounted on every protected page.
 * It never grants access; it only removes already-rendered content from view
 * when the session changes underneath this tab:
 *  - another tab locked / signed out  -> BroadcastChannel message
 *  - locked from another device, or the session expired -> re-check on focus
 *  - page restored from the back/forward cache -> force a fresh server render
 */
export function SessionGuard() {
  useEffect(() => {
    const unsubscribe = subscribeAuth((message) => {
      if (message.type === "locked") hardNavigate("/lock");
      if (message.type === "signed_out") hardNavigate(loginPath(message.reason));
    });

    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      const status = await fetchSessionStatus();
      if (status === "locked") hardNavigate("/lock");
      if (status === "anonymous") hardNavigate(loginPath("session_expired"));
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
