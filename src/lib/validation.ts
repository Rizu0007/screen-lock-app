import { z } from "zod";

export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 3;

/**
 * Exactly six ASCII digits. `[0-9]` rather than `\d` so that other Unicode
 * digit characters are rejected.
 */
export const pinSchema = z
  .string({ error: "Enter your 6-digit PIN." })
  .regex(/^[0-9]{6}$/, "PIN must be exactly 6 digits.");

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address." }))
    .refine((v) => v.length <= 254, "Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(256, "Password is too long."),
});

/** Keeps only ASCII digits and caps the length; used by the PIN input as the user types. */
export function sanitizePinInput(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);
}
