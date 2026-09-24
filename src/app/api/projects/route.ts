import { PROJECTS } from "@/lib/projects";
import { getAuthState } from "@/server/dal";

/**
 * Example data API. Demonstrates that the lock is enforced at the data layer,
 * not just in the UI: a locked session receives 423 Locked and no data.
 *   401 {code: "UNAUTHENTICATED"} - no valid session
 *   423 {code: "SCREEN_LOCKED"}   - valid session, screen locked
 */
export async function GET() {
  const state = await getAuthState();
  const headers = { "Cache-Control": "no-store" };

  if (state.status === "anonymous") {
    return Response.json({ code: "UNAUTHENTICATED" }, { status: 401, headers });
  }
  if (state.status === "locked") {
    return Response.json({ code: "SCREEN_LOCKED" }, { status: 423, headers });
  }
  return Response.json({ data: PROJECTS }, { headers });
}
