import { describe, expect, it } from "vitest";
import { returnToOrDefault, sanitizeReturnTo } from "@/lib/return-to";

describe("sanitizeReturnTo", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/projects?page=2", "/projects?page=2"],
    ["/projects?page=3#top", "/projects?page=3#top"],
    ["/projects/7", "/projects/7"],
  ])("keeps in-app path %s", (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/%5Cevil.com",
    "/%2F%2Fevil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "dashboard",
    "",
    "/lock",
    "/login?reason=x",
    "/api/projects",
    "/_next/static/x.js",
    "/%E0%A4%A",
    `/${"a".repeat(3000)}`,
  ])("rejects %j", (input) => {
    expect(sanitizeReturnTo(input)).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(sanitizeReturnTo(undefined)).toBeNull();
    expect(sanitizeReturnTo({ toString: () => "/dashboard" })).toBeNull();
  });

  it("falls back to the dashboard", () => {
    expect(returnToOrDefault("//evil.com")).toBe("/dashboard");
  });
});
