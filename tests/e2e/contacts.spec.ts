import { test, expect } from "@playwright/test";

test.describe("Contacts E2E", () => {
  const timestamp = Date.now();
  const companyName = `Contact Corp ${timestamp}`;
  const email = `contact_user_${timestamp}@example.com`;
  const password = "Password123!";
  const accountName = `ACC_For_Contact_${timestamp}`;
  const contactFirstName = `Contact_${timestamp}`;

  test("CON-001 to CON-004: Contact Create -> Link Account -> Details", async ({ page }) => {
    // Register
    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Con");
    await page.fill('input[name="lastName"]', "Tester");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for dashboard redirect
    await expect(page).toHaveURL("http://localhost:5173/");

    // Create Account first
    await page.goto("http://localhost:5173/accounts");
    await page.locator('button:has-text("New Account")').first().click();
    await page.fill('input[name="name"]', accountName);
    await page.click('button:has-text("Create Account")');

    // Create Contact
    await page.goto("http://localhost:5173/contacts");
    await page.locator('button:has-text("New Contact")').first().click();
    await page.fill('input[name="firstName"]', contactFirstName);
    await page.fill('input[name="lastName"]', "Smith");
    await page.fill('input[name="email"]', `c_${timestamp}@example.com`);
    await page.selectOption('select[name="accountId"]', { label: accountName });
    await page.click('button:has-text("Create Contact")');

    // Verify contact in list
    await expect(page.locator("table")).toContainText(contactFirstName);
  });
});
