import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MAX_PIN_ATTEMPTS } from "@/lib/validation";
import { requireLockedSession } from "@/server/dal";
import { getFailedPinAttempts } from "@/server/lock/service";
import { LockScreenGuard } from "./lock-screen-guard";
import { UnlockForm } from "./unlock-form";

export const metadata: Metadata = { title: "Locked" };

/** Rendered only for a locked session; no app data is loaded. */
export default async function LockPage() {
  const session = await requireLockedSession();
  const failed = await getFailedPinAttempts(session.userId);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <LockScreenGuard />
      <Card className="w-full max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <LockKeyhole className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Screen locked</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Signed in as <span className="font-medium text-zinc-700 dark:text-zinc-300">{session.email}</span>
        </p>
        <UnlockForm initialAttemptsRemaining={MAX_PIN_ATTEMPTS - failed} />
      </Card>
    </main>
  );
}
