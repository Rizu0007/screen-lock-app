import { getAuthState } from "@/server/dal";

/** Session state for open tabs. No user data. */
export async function GET() {
  const state = await getAuthState();
  return Response.json({ status: state.status }, { headers: { "Cache-Control": "no-store" } });
}
