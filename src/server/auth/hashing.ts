import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/server/env";

/**
 * Argon2id (OWASP minimum: 19 MiB, t=2) keyed with a server-side pepper.
 * Stored as `<pepperVersion>$<PHC>` so the pepper can be rotated.
 */
const PARAMS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const CURRENT_PEPPER_VERSION = "p1";

function pepper(version: string): Uint8Array {
  if (version !== CURRENT_PEPPER_VERSION) {
    throw new Error(`Unknown pepper version: ${version}`);
  }
  return Buffer.from(env().AUTH_PEPPER, "utf8");
}

export async function hashSecret(plain: string): Promise<string> {
  const phc = await hash(plain, { ...PARAMS, secret: pepper(CURRENT_PEPPER_VERSION) });
  return `${CURRENT_PEPPER_VERSION}$${phc}`;
}

export async function verifySecret(stored: string, plain: string): Promise<boolean> {
  const sep = stored.indexOf("$");
  if (sep <= 0) return false;
  try {
    return await verify(stored.slice(sep + 1), plain, {
      secret: pepper(stored.slice(0, sep)),
    });
  } catch {
    // Malformed hash or unknown pepper version.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Equalises login timing for unknown emails (prevents user enumeration). */
export async function burnVerifyTime(plain: string): Promise<void> {
  dummyHash ??= hashSecret(randomBytes(16).toString("hex"));
  await verifySecret(await dummyHash, plain);
}

/** 256-bit random, URL-safe session token. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
