"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { unlockAction, type UnlockState } from "@/app/actions/lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { broadcastAuth, hardNavigate, loginPath, safeReturnPath } from "@/lib/auth-channel";
import { MAX_PIN_ATTEMPTS, PIN_LENGTH, sanitizePinInput } from "@/lib/validation";

export function UnlockForm({ initialAttemptsRemaining }: { initialAttemptsRemaining: number }) {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(unlockAction, {
    status: "idle",
    attemptsRemaining: initialAttemptsRemaining,
  });
  const [pin, setPin] = useState("");
  const [signingOut, startSignOut] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "unlocked") {
      const target = safeReturnPath(state.returnTo);
      broadcastAuth({ type: "unlocked", returnTo: target });
      hardNavigate(target);
    } else if (state.status === "signed_out") {
      broadcastAuth({ type: "signed_out", reason: state.reason });
      hardNavigate(loginPath(state.reason));
    } else if (state.status === "invalid" || state.status === "error") {
      inputRef.current?.focus();
    }
  }, [state]);

  const navigating = state.status === "unlocked" || state.status === "signed_out";
  const busy = pending || navigating || signingOut;
  const complete = pin.length === PIN_LENGTH;

  const message =
    state.status === "invalid" || state.status === "error"
      ? state.message
      : state.status === "idle" && state.attemptsRemaining < MAX_PIN_ATTEMPTS
        ? `${state.attemptsRemaining} ${state.attemptsRemaining === 1 ? "attempt" : "attempts"} remaining before you are signed out.`
        : "";
  const hasError = state.status === "invalid" || state.status === "error";

  const signOut = () =>
    startSignOut(async () => {
      await logoutAction();
      broadcastAuth({ type: "signed_out", reason: "signed_out" });
      hardNavigate(loginPath("signed_out"));
    });

  return (
    <div className="mt-6">
      <form
        action={(formData) => {
          // The submitted value is already in formData; clearing now means a
          // wrong PIN leaves an empty field for the next attempt.
          setPin("");
          formAction(formData);
        }}
        className="space-y-3 text-left"
        noValidate
      >
        <label htmlFor="pin" className="block text-sm font-medium">
          Enter your 6-digit PIN
        </label>
        {/*
          The single PIN field required by the brief. type="password" masks the
          digits; inputMode="numeric" shows a number pad on mobile. The name is
          not "password" to discourage password managers from saving it.
        */}
        <Input
          ref={inputRef}
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={PIN_LENGTH}
          autoComplete="off"
          autoFocus
          required
          value={pin}
          onChange={(e) => setPin(sanitizePinInput(e.target.value))}
          disabled={busy}
          aria-invalid={hasError || undefined}
          aria-describedby="pin-help pin-status"
          data-1p-ignore
          data-lpignore="true"
          className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
        />
        <p id="pin-help" className="text-xs text-zinc-500">
          Digits only. {MAX_PIN_ATTEMPTS} incorrect attempts will sign you out.
        </p>
        <p
          id="pin-status"
          role="status"
          aria-live="polite"
          className={hasError ? "min-h-5 text-sm text-red-600" : "min-h-5 text-sm text-amber-700"}
        >
          {message}
        </p>
        <Button type="submit" className="w-full" disabled={!complete || busy}>
          {pending ? "Checking…" : navigating ? "Unlocking…" : "Unlock"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Not you, or forgot your PIN?{" "}
        <Button variant="link" className="h-auto" onClick={signOut} disabled={busy}>
          Sign out
        </Button>
      </p>
    </div>
  );
}
