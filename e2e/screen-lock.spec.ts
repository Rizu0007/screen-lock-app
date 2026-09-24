import { expect, test } from "@playwright/test";
import { ALEX, DEMO, expectLockScreen, lock, login, submitPin, WRONG_PIN } from "./helpers";

test.describe("Part A: screen lock", () => {
  test("A1/A6: lock from any page and return to that exact page after unlock", async ({ page }) => {
    await login(page);
    for (const path of ["/dashboard", "/projects?page=2", "/projects/7", "/settings"]) {
      await page.goto(path);
      await lock(page);
      await submitPin(page, DEMO.pin);
      await page.waitForURL((url) => `${url.pathname}${url.search}` === path);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    }
  });

  test("A1: keyboard shortcut locks the app", async ({ page }) => {
    await login(page);
    await page.goto("/projects");
    await lock(page, "shortcut");
    await expectLockScreen(page);
  });

  test("A6: query string and hash are preserved", async ({ page }) => {
    await login(page);
    await page.goto("/projects?page=3#top");
    await lock(page);
    await submitPin(page, DEMO.pin);
    await page.waitForURL("**/projects?page=3#top");
  });

  test("A2/A3/A4: dedicated lock screen with a single 6-digit numeric field", async ({ page }) => {
    await login(page);
    await lock(page);
    await expectLockScreen(page);

    await expect(page.locator("input")).toHaveCount(1);
    const input = page.getByLabel("Enter your 6-digit PIN");
    await expect(input).toHaveAttribute("type", "password");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toBeFocused();

    const unlock = page.getByRole("button", { name: "Unlock" });
    await input.pressSequentially("12ab3");
    await expect(input).toHaveValue("123");
    await expect(unlock).toBeDisabled();

    await input.pressSequentially("4x5678");
    await expect(input).toHaveValue("123456");
    await expect(unlock).toBeEnabled();
  });

  test("A7: unlocking needs only the PIN, not the password", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await lock(page);
    const visited: string[] = [];
    page.on("framenavigated", (frame) => visited.push(new URL(frame.url()).pathname));
    await submitPin(page, DEMO.pin);
    await page.waitForURL("**/settings");
    expect(visited).not.toContain("/login");
    await expect(page.getByRole("cell", { name: "Screen unlocked" }).first()).toBeVisible();
  });
});

test.describe("Part B: failed attempts", () => {
  test("B1: wrong PIN shows remaining attempts, and the count survives a refresh", async ({ page }) => {
    await login(page);
    await lock(page);
    await submitPin(page, WRONG_PIN);
    await expect(page.getByRole("status").filter({ hasText: "Incorrect PIN" })).toContainText("2 attempts remaining");
    await expect(page.getByLabel("Enter your 6-digit PIN")).toHaveValue("");

    await page.reload();
    await expectLockScreen(page);
    await expect(page.getByText("2 attempts remaining before you are signed out.")).toBeVisible();
  });

  test("B2/B4: three wrong PINs sign the user out; the old cookie is dead", async ({ page, browser, context }) => {
    await login(page);
    await page.goto("/projects");
    await lock(page);
    const lockedCookies = await context.cookies();

    await submitPin(page, WRONG_PIN);
    await expect(page.getByText("2 attempts remaining", { exact: false })).toBeVisible();
    await submitPin(page, WRONG_PIN);
    await expect(page.getByText("1 attempt remaining", { exact: false })).toBeVisible();
    await submitPin(page, WRONG_PIN);

    await page.waitForURL("**/login?reason=pin_lockout");
    await expect(page.getByText("signed out after 3 incorrect PIN attempts")).toBeVisible();

    for (const path of ["/dashboard", "/lock", "/projects"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }

    // Replaying the pre-lockout cookie in a fresh browser does not help.
    const replay = await browser.newContext();
    await replay.addCookies(lockedCookies);
    const replayPage = await replay.newPage();
    await replayPage.goto("/dashboard");
    await expect(replayPage).toHaveURL(/\/login/);
    await replay.close();

    // Standard login works again afterwards.
    await login(page);
  });

  test("B3: a correct PIN before the third failure resets the counter", async ({ page }) => {
    await login(page);
    await lock(page);
    await submitPin(page, WRONG_PIN);
    await expect(page.getByText("2 attempts remaining", { exact: false })).toBeVisible();
    await submitPin(page, WRONG_PIN);
    await expect(page.getByText("1 attempt remaining", { exact: false })).toBeVisible();
    await submitPin(page, DEMO.pin); // correct on the 3rd attempt
    await page.waitForURL("**/dashboard");

    await lock(page);
    await submitPin(page, WRONG_PIN);
    await expect(page.getByText("2 attempts remaining", { exact: false })).toBeVisible();
    await submitPin(page, WRONG_PIN);
    await expect(page.getByText("1 attempt remaining", { exact: false })).toBeVisible();
    await expectLockScreen(page);
  });

  test("B1: attempts are counted per user across devices, and lockout ends every session", async ({ browser }) => {
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();
    const a = await deviceA.newPage();
    const b = await deviceB.newPage();
    await login(a, ALEX);
    await login(b, ALEX);
    await lock(a);
    await lock(b);

    await submitPin(a, WRONG_PIN);
    await expect(a.getByText("2 attempts remaining", { exact: false })).toBeVisible();
    await submitPin(b, WRONG_PIN);
    await expect(b.getByText("1 attempt remaining", { exact: false })).toBeVisible();
    await submitPin(a, WRONG_PIN);
    await a.waitForURL("**/login?reason=pin_lockout");

    await b.reload();
    await expect(b).toHaveURL(/\/login/);
    await deviceA.close();
    await deviceB.close();
  });
});

test.describe("Bypass prevention", () => {
  test("direct URLs, refresh and the login page all lead back to the lock screen", async ({ page }) => {
    await login(page);
    await lock(page);
    for (const path of ["/dashboard", "/projects/3", "/settings", "/", "/login"]) {
      await page.goto(path);
      await expectLockScreen(page);
    }
    await page.reload();
    await expectLockScreen(page);
  });

  test("the back button does not reveal the previous page", async ({ page }) => {
    await login(page);
    await page.goto("/projects");
    await page.goto("/projects/5");
    await lock(page);
    await page.goBack();
    await expectLockScreen(page);
    await expect(page.getByText("All projects")).toHaveCount(0);
  });

  test("the data API refuses a locked session with 423", async ({ page }) => {
    await login(page);
    expect((await page.request.get("/api/projects")).status()).toBe(200);
    await lock(page);
    const locked = await page.request.get("/api/projects");
    expect(locked.status()).toBe(423);
    expect(await locked.json()).toEqual({ code: "SCREEN_LOCKED" });
  });

  test("protected pages are not cacheable", async ({ page }) => {
    await login(page);
    const response = await page.goto("/projects");
    expect(response?.headers()["cache-control"]).toContain("no-store");
  });

  test("the lock screen redirects away once the session is unlocked", async ({ page }) => {
    await login(page);
    await page.goto("/lock");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("locking in one tab locks the others; unlocking follows too", async ({ context }) => {
    const first = await context.newPage();
    await login(first);
    const second = await context.newPage();
    await second.goto("/projects");

    await first.bringToFront();
    await lock(first);
    await second.waitForURL("**/lock");
    await expectLockScreen(second);

    await submitPin(second, DEMO.pin);
    await second.waitForURL("**/dashboard");
    await first.waitForURL("**/dashboard");
  });

  test("the session cookie is HttpOnly and SameSite=Lax", async ({ page, context }) => {
    await login(page);
    const cookie = (await context.cookies()).find((c) => c.name.endsWith("session"));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });
});

test("sign out from the lock screen ends the session", async ({ page }) => {
  await login(page);
  await lock(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login?reason=signed_out");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
