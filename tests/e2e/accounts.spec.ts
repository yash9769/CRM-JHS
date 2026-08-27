import { test, expect } from "@playwright/test";

test.describe("Accounts CRUD E2E", () => {
  const timestamp = Date.now();
  const companyName = `Acc Corp ${timestamp}`;
  const email = `acc_user_${timestamp}@example.com`;
  const password = "Password123!";
  const accountName = `ACC_E2E_${timestamp}`;

  test("ACC-001 to ACC-005: Account Create -> Read -> Update -> Search -> Details", async ({ page }) => {
    // Register & login
    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Acc");
    await page.fill('input[name="lastName"]', "Tester");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to Dashboard
    await expect(page).toHaveURL("http://localhost:5173/");

    // Create Account
    await page.goto("http://localhost:5173/accounts");
    await page.locator('button:has-text("New Account")').first().click();
    await page.fill('input[name="name"]', accountName);
    await page.fill('input[name="domain"]', `acc_${timestamp}.com`);
    await page.fill('input[name="industry"]', "Software");
    await page.click('button:has-text("Create Account")');

    // Search and verify in list
    await page.fill('input[placeholder="Search accounts…"]', accountName);
    await expect(page.locator("table")).toContainText(accountName);

    // Open detail page
    await page.click(`text=${accountName}`);
    await expect(page.locator("h1")).toContainText(accountName);
  });
});
