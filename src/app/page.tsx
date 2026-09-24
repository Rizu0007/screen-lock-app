import { redirect } from "next/navigation";
import { getAuthState } from "@/server/dal";

export default async function Home() {
  const state = await getAuthState();
  if (state.status === "active") redirect("/dashboard");
  if (state.status === "locked") redirect("/lock");
  redirect("/login");
}
