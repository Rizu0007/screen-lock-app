"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { broadcastAuth, hardNavigate, loginPath } from "@/lib/auth-channel";

/** Sign out is a POST (Server Action), never a GET link that could be forged or prefetched. */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutAction();
          broadcastAuth({ type: "signed_out", reason: "signed_out" });
          hardNavigate(loginPath("signed_out"));
        })
      }
    >
      <LogOut className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
