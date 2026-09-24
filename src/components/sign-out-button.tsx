"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

function SubmitButton({ variant, label }: { variant: "ghost" | "link"; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={variant === "link" ? "h-auto" : undefined}>
      {variant === "ghost" && <LogOut className="size-4" aria-hidden />}
      {label}
    </Button>
  );
}

/** Sign out is a POST form (Server Action), never a GET link that could be forged or prefetched. */
export function SignOutButton({ variant = "ghost", label = "Sign out" }: { variant?: "ghost" | "link"; label?: string }) {
  return (
    <form action={logoutAction} className="inline">
      <SubmitButton variant={variant} label={label} />
    </form>
  );
}
