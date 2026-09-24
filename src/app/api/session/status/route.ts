import { getAuthState } from "@/server/dal";

/**
 * Minimal session probe used by open tabs to notice a lock or sign-out that
 * happened elsewhere. Exposes the state only; never user data.
 */
export async function GET() {
  const state = await getAuthState();
  return Response.json({ status: state.status }, { headers: { "Cache-Control": "no-store" } });
}
