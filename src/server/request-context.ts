import "server-only";
import { headers } from "next/headers";

export type RequestContext = { ip: string; userAgent: string | null };

/** Trusts x-forwarded-for: correct behind Vercel or a proxy that overwrites it. */
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}
