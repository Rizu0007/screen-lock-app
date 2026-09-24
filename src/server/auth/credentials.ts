import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { burnVerifyTime, verifySecret } from "@/server/auth/hashing";

export type CredentialResult = { ok: true; userId: string } | { ok: false; userId: string | null };

/** Unknown emails still run a full Argon2 verify, so timing doesn't reveal accounts. */
export async function verifyCredentials(email: string, password: string): Promise<CredentialResult> {
  const [user] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    await burnVerifyTime(password);
    return { ok: false, userId: null };
  }
  const valid = await verifySecret(user.passwordHash, password);
  return valid ? { ok: true, userId: user.id } : { ok: false, userId: user.id };
}
