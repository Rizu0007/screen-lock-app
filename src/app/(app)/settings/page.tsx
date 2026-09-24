import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import type { AuthEventType } from "@/db/schema";
import { listRecentAuthEvents } from "@/server/audit";
import { requireActiveSession } from "@/server/dal";

export const metadata: Metadata = { title: "Settings" };

const EVENT_LABELS: Record<AuthEventType, string> = {
  login_success: "Signed in",
  login_failure: "Failed sign-in",
  login_throttled: "Sign-in blocked (too many attempts)",
  logout: "Signed out",
  screen_locked: "Screen locked",
  unlock_success: "Screen unlocked",
  unlock_failure: "Incorrect PIN",
  pin_lockout: "Signed out after 3 incorrect PINs",
};

export default async function SettingsPage() {
  const session = await requireActiveSession();
  const events = await listRecentAuthEvents(session.userId, 15);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-zinc-500">Email</dt>
          <dd>{session.email}</dd>
          <dt className="text-zinc-500">Screen-lock PIN</dt>
          <dd>Configured (6 digits)</dd>
        </dl>
      </Card>

      <Card className="p-0">
        <h2 className="px-6 pt-6 font-semibold">Recent security activity</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-y border-zinc-200 text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-2 font-medium">Event</th>
              <th className="px-6 py-2 font-medium">When (UTC)</th>
              <th className="px-6 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-6 py-2">
                  {EVENT_LABELS[e.type] ?? e.type}
                  {e.detail && <span className="ml-2 text-zinc-500">({e.detail})</span>}
                </td>
                <td className="px-6 py-2 tabular-nums">
                  {e.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-6 py-2 font-mono text-xs">{e.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
