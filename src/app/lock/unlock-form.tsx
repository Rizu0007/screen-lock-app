"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { unlockAction, type UnlockState } from "@/app/actions/lock";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PIN_ATTEMPTS, PIN_LENGTH, sanitizePinInput } from "@/lib/validation";

const remainingText = (n: number) =>
  `${n} ${n === 1 ? "attempt" : "attempts"} remaining before you are signed out.`;

export function UnlockForm({ initialAttemptsRemaining }: { initialAttemptsRemaining: number }) {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(unlockAction, {
    status: "idle",
    attemptsRemaining: initialAttemptsRemaining,
  });
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // After a rejected attempt, put the cursor back in the (already cleared) field.
  useEffect(() => {
    if (state.status !== "idle") inputRef.current?.focus();
  }, [state]);

  const hasError = state.status !== "idle";
  const message = hasError
    ? state.message
    : state.attemptsRemaining < MAX_PIN_ATTEMPTS
      ? remainingText(state.attemptsRemaining)
      : "";

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
          disabled={pending}
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
        <Button type="submit" className="w-full" disabled={pin.length !== PIN_LENGTH || pending}>
          {pending ? "Checking…" : "Unlock"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500">
        Not you, or forgot your PIN? <SignOutButton variant="link" />
      </p>
    </div>
  );
}
