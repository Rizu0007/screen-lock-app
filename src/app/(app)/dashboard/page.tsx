import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PROJECTS } from "@/lib/projects";
import { requireActiveSession } from "@/server/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireActiveSession();
  const active = PROJECTS.filter((p) => p.status === "Active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Welcome back, {session.email}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-500">Projects</p>
          <p className="mt-1 text-3xl font-semibold">{PROJECTS.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Active</p>
          <p className="mt-1 text-3xl font-semibold">{active}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Session expires</p>
          <p className="mt-1 text-lg font-semibold">
            {session.expiresAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Try the screen lock</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            Open a page such as <Link className="underline" href="/projects?page=2">Projects, page 2</Link>, then press{" "}
            <kbd className="rounded border px-1 font-mono text-xs">Ctrl</kbd>+<kbd className="rounded border px-1 font-mono text-xs">Shift</kbd>+
            <kbd className="rounded border px-1 font-mono text-xs">L</kbd> or the Lock button.
          </li>
          <li>Unlock with your PIN to return to the same page, without your password.</li>
          <li>Three incorrect PINs sign you out of every session.</li>
          <li>While locked, refreshing, the back button or typing a URL all lead back to the lock screen.</li>
        </ul>
      </Card>
    </div>
  );
}
