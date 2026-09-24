import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { burnVerifyTime, verifySecret } from "@/server/auth/hashing";

/**
 * Verifies email + password. Unknown emails still pay for a full Argon2
 * verification, so timing does not reveal which accounts exist.
 */
export async function verifyCredentials(email: string, password: string) {
  const [user] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    await burnVerifyTime(password);
    return null;
  }
  return (await verifySecret(user.passwordHash, password)) ? { userId: user.id } : null;
}
