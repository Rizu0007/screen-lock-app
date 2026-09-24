import "server-only";
import { headers } from "next/headers";

export type RequestContext = { ip: string; userAgent: string | null };

/**
 * Client metadata for audit logging and login throttling.
 * NOTE: x-forwarded-for is only trustworthy behind a proxy that overwrites it;
 * configure the deployment's reverse proxy accordingly.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}
