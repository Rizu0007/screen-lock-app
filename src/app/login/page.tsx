import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { DEMO_USERS } from "@/lib/demo-users";
import { signedOutMessage } from "@/lib/login-reasons";
import { getAuthState } from "@/server/dal";
import { demoAccountsVisible } from "@/server/env";
import { LoginForm } from "./login-form";
import { SignedOutBeacon } from "./signed-out-beacon";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  // The login page must never become a way around the lock screen.
  const state = await getAuthState();
  if (state.status === "active") redirect("/dashboard");
  if (state.status === "locked") redirect("/lock");

  const { reason } = await searchParams;
  const notice = signedOutMessage(reason);
  const showDemo = demoAccountsVisible();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <SignedOutBeacon />
      <div className="w-full max-w-sm space-y-4">
        <Card>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-500">Use your email and password.</p>
          {notice && (
            <p
              role="status"
              className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              {notice}
            </p>
          )}
          <LoginForm />
        </Card>

        {showDemo && (
          <Card className="p-4 text-xs text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">Demo accounts</p>
            <ul className="mt-2 space-y-1 font-mono">
              {DEMO_USERS.map((u) => (
                <li key={u.email}>
                  {u.email} / {u.password} · PIN {u.pin}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </main>
  );
}
