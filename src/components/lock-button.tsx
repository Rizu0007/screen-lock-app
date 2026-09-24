"use client";

import { Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { lockAction } from "@/app/actions/lock";
import { Button } from "@/components/ui/button";
import { broadcastAuthChange, hardNavigate, loginPath } from "@/lib/auth-channel";

/** Ctrl+Shift+L on every platform (Cmd+Shift+L is taken by Safari's sidebar). */
function isLockShortcut(event: KeyboardEvent) {
  return event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && event.code === "KeyL";
}

/**
 * Locks the app from any page. The screen is covered immediately so nothing
 * stays readable while the request is in flight; if the server call fails the
 * cover is removed and an error is shown, never pretending the app is locked.
 */
export function LockButton() {
  const [state, setState] = useState<"idle" | "locking" | "failed">("idle");
  const inFlight = useRef(false);

  const lock = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("locking");
    try {
      const { pathname, search, hash } = window.location;
      const result = await lockAction(`${pathname}${search}${hash}`);
      broadcastAuthChange();
      hardNavigate(result.ok ? "/lock" : loginPath(result.reason));
    } catch {
      inFlight.current = false;
      setState("failed");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isLockShortcut(event)) return;
      event.preventDefault();
      void lock();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lock]);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => void lock()}
        disabled={state === "locking"}
        title="Lock screen (Ctrl+Shift+L)"
        aria-keyshortcuts="Control+Shift+L"
      >
        <Lock className="size-4" aria-hidden />
        Lock
      </Button>

      {state === "locking" && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-100 dark:bg-zinc-950"
        >
          <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Lock className="size-4" aria-hidden /> Locking…
          </p>
        </div>
      )}

      {state === "failed" && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 shadow dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          Could not lock the screen. Check your connection.
          <Button variant="secondary" className="h-8" onClick={() => void lock()}>
            Retry
          </Button>
        </div>
      )}
    </>
  );
}
