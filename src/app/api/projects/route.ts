import { PROJECTS } from "@/lib/projects";
import { getAuthState } from "@/server/dal";

/** Example data API: 401 when signed out, 423 when locked. */
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
