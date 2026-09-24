import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { LockButton } from "@/components/lock-button";
import { SessionGuard } from "@/components/session-guard";
import { SignOutButton } from "@/components/sign-out-button";
import { requireActiveSession } from "@/server/dal";

/**
 * Shell for every authenticated page. The guard here covers the first render;
 * because layouts are not re-rendered on client navigation, each page (and
 * each Server Action / Route Handler) calls requireActiveSession() itself.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireActiveSession();

  return (
    <>
      <SessionGuard />
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Workspace</span>
            <AppNav />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-zinc-500 sm:inline">{session.email}</span>
            <LockButton />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
