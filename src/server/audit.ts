import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authEvents, type AuthEventType } from "@/db/schema";
import { getRequestContext } from "@/server/request-context";

type EventInput = {
  type: AuthEventType;
  userId?: string | null;
  sessionId?: string | null;
  detail?: string;
};

/**
 * Appends a security event. Audit failures are logged but never block the
 * user-facing flow (e.g. a lockout must still log the user out).
 */
export async function recordAuthEvent(event: EventInput): Promise<void> {
  try {
    const ctx = await getRequestContext();
    await getDb()
      .insert(authEvents)
      .values({
        type: event.type,
        userId: event.userId ?? null,
        sessionId: event.sessionId ?? null,
        detail: event.detail ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
  } catch (error) {
    console.error("[audit] failed to record auth event", event.type, error);
  }
}

export async function listRecentAuthEvents(userId: string, limit = 10) {
  return getDb()
    .select({
      id: authEvents.id,
      type: authEvents.type,
      ip: authEvents.ip,
      detail: authEvents.detail,
      createdAt: authEvents.createdAt,
    })
    .from(authEvents)
    .where(eq(authEvents.userId, userId))
    .orderBy(desc(authEvents.createdAt))
    .limit(limit);
}
