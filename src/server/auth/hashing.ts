import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/server/env";

/**
 * Argon2id (the library default) with OWASP's recommended minimum
 * parameters: 19 MiB memory, 2 iterations, 1 lane.
 *
 * Every hash is keyed with a server-side pepper (Argon2's `secret` input).
 * A 6-digit PIN has only 10^6 possible values, so without the pepper a leaked
 * database would allow an offline brute force in hours; with it, the attacker
 * also needs the application secret.
 *
 * Stored format: `<pepperVersion>$<argon2 PHC string>`, so the pepper can be
 * rotated later by adding a new version and re-hashing on successful verify.
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
    // Malformed hash or unknown pepper version: treat as a non-match, never throw to the caller.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Runs a full Argon2 verification against a throwaway hash so that "unknown
 * email" costs the same time as "wrong password" (prevents user enumeration
 * by response timing).
 */
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
