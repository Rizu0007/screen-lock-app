import { describe, expect, it } from "vitest";
import { signedOutMessage } from "@/lib/login-reasons";
import { loginSchema, pinSchema, sanitizePinInput } from "@/lib/validation";

describe("pinSchema", () => {
  it("accepts exactly six ASCII digits", () => {
    expect(pinSchema.safeParse("012345").success).toBe(true);
  });

  it.each(["12345", "1234567", "12345a", "abcdef", " 123456", "123 456", "１２３４５６", "١٢٣٤٥٦", "", "12.345"])(
    "rejects %j",
    (value) => {
      expect(pinSchema.safeParse(value).success).toBe(false);
    },
  );

  it("rejects non-strings", () => {
    expect(pinSchema.safeParse(123456).success).toBe(false);
    expect(pinSchema.safeParse(null).success).toBe(false);
  });
});

describe("sanitizePinInput", () => {
  it("strips non-digits and caps at six", () => {
    expect(sanitizePinInput("12ab34-56 78")).toBe("123456");
    expect(sanitizePinInput("１２3")).toBe("3");
  });
});

describe("loginSchema", () => {
  it("normalises email", () => {
    expect(loginSchema.parse({ email: "  Demo@Example.COM ", password: "x" }).email).toBe("demo@example.com");
  });

  it("rejects bad input", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("signedOutMessage", () => {
  it("only maps allow-listed reasons", () => {
    expect(signedOutMessage("pin_lockout")).toMatch(/3 incorrect PIN/);
    expect(signedOutMessage("<script>")).toBeNull();
    expect(signedOutMessage("toString")).toBeNull();
    expect(signedOutMessage(["pin_lockout"])).toBeNull();
  });
});

describe("normalizeDatabaseUrl", () => {
  it("drops libpq-only options but keeps sslmode", async () => {
    const { normalizeDatabaseUrl } = await import("@/db/connection-url");
    const out = normalizeDatabaseUrl(
      "postgresql://u:p@ep-x-pooler.eu.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
    expect(out).toBe("postgresql://u:p@ep-x-pooler.eu.aws.neon.tech/neondb?sslmode=require");
  });
});
