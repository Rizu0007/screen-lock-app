import { notFound } from "next/navigation";
import { requireActiveSession } from "@/server/dal";

// Unknown URLs render the 404 inside the app shell, so Lock is available on every page.
export default async function CatchAll() {
  await requireActiveSession();
  notFound();
}
