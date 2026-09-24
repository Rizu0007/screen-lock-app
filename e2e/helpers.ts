import { expect, type Page } from "@playwright/test";
import { DEMO_USERS } from "../src/lib/demo-users";

export const DEMO = DEMO_USERS[0];
export const ALEX = DEMO_USERS[1];
export const WRONG_PIN = "000000";

type DemoUser = (typeof DEMO_USERS)[number];

export async function login(page: Page, user: DemoUser = DEMO) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

export async function lock(page: Page, via: "button" | "shortcut" = "button") {
  if (via === "button") {
    await page.getByRole("button", { name: "Lock" }).click();
  } else {
    await page.keyboard.press("Control+Shift+L");
  }
  await page.waitForURL("**/lock");
  await expect(page.getByRole("heading", { name: "Screen locked" })).toBeVisible();
}

export async function submitPin(page: Page, pin: string) {
  const input = page.getByLabel("Enter your 6-digit PIN");
  await input.fill(pin);
  await page.getByRole("button", { name: "Unlock" }).click();
}

export async function expectLockScreen(page: Page) {
  await expect(page).toHaveURL(/\/lock$/);
  await expect(page.getByRole("heading", { name: "Screen locked" })).toBeVisible();
  // No application chrome or data is rendered while locked.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
}
