import { test, expect } from "@playwright/test";

test.describe("Authentication E2E", () => {
  const timestamp = Date.now();
  const companyName = `Auth Corp ${timestamp}`;
  const email = `auth_user_${timestamp}@example.com`;
  const password = "Password123!";

  test("AUTH-001 & AUTH-007: Register -> Logout -> Login -> Auth Route Protection", async ({ page }) => {
    // 1. Register
    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Auth");
    await page.fill('input[name="lastName"]', "Tester");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    // 2. Logout via Header Menu
    await page.click('header button:has(div)');
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");

    // 3. Direct route access without auth redirects to login
    await page.goto("http://localhost:5173/accounts");
    await expect(page).toHaveURL("http://localhost:5173/login");

    // 4. Invalid login attempt
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "WrongPassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("body")).toContainText("Invalid credentials");

    // 5. Valid login
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("http://localhost:5173/");
  });
});
