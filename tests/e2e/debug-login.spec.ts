import { test, expect } from "@playwright/test";

test("debug login", async ({ page }) => {
  await page.goto("http://localhost:5173/login");
  await page.fill('input[type="email"]', "authreg_1786301224935@example.com");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("http://localhost:5173/");
});
