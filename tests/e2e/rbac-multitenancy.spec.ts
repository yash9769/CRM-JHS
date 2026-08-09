import { test, expect } from "@playwright/test";

test.describe("Multi-Tenancy & RBAC E2E Verification", () => {
  test.setTimeout(90000);

  const timestamp = Date.now();
  const companyA = `Tenant A ${timestamp}`;
  const companyB = `Tenant B ${timestamp}`;

  const emailA = `admin_a_${timestamp}@example.com`;
  const emailB = `admin_b_${timestamp}@example.com`;
  const repEmail = `rep_${timestamp}@example.com`;
  const password = "Password123!";

  const accountAName = `Account A ${timestamp}`;
  const accountBName = `Account B ${timestamp}`;

  test("Tenant Isolation & Role-Based Access Control Flow", async ({ page }) => {
    // ========================================================
    // 1. REGISTER TENANT A & CREATE RECORD
    // ========================================================
    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyA);
    await page.fill('input[name="firstName"]', "Alice");
    await page.fill('input[name="lastName"]', "TenantA");
    await page.fill('input[name="email"]', emailA);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    // Create Account A
    await page.goto("http://localhost:5173/accounts");
    await page.locator('button:has-text("New Account")').first().click();
    await page.fill('input[name="name"]', accountAName);
    await page.click('button:has-text("Create Account")');
    await expect(page.locator("table")).toContainText(accountAName);

    // Logout Tenant A
    await page.click("header button:has(div)");
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");

    // ========================================================
    // 2. REGISTER TENANT B & VERIFY ISOLATION
    // ========================================================
    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyB);
    await page.fill('input[name="firstName"]', "Bob");
    await page.fill('input[name="lastName"]', "TenantB");
    await page.fill('input[name="email"]', emailB);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    // Verify Account A is not visible under Tenant B
    await page.goto("http://localhost:5173/accounts");
    await expect(page.locator("body")).not.toContainText(accountAName);

    // Create Account B
    await page.locator('button:has-text("New Account")').first().click();
    await page.fill('input[name="name"]', accountBName);
    await page.click('button:has-text("Create Account")');
    await expect(page.locator("table")).toContainText(accountBName);

    // ========================================================
    // 3. VERIFY RBAC: ADMIN HAS INVITE, SALES_REP DOES NOT
    // ========================================================
    // Tenant B Admin goes to settings
    await page.goto("http://localhost:5173/settings");
    
    // Admin should see the "Invite" button
    const inviteButton = page.locator('button:has-text("Invite")');
    await expect(inviteButton).toBeVisible();

    // Invite Sales Rep User
    await inviteButton.click();
    await page.locator('label:has-text("First name") input').fill("Sam");
    await page.locator('label:has-text("Last name") input').fill("Rep");
    await page.locator('label:has-text("Email") input').fill(repEmail);
    await page.locator('label:has-text("Role") select').selectOption("SALES_REP");
    await page.locator('label:has-text("Temporary password") input').fill(password);
    await page.click('form button:has-text("Invite")');

    // Verify User invited successfully in table
    await expect(page.locator("table").first()).toContainText(repEmail);

    // Logout Tenant B Admin
    await page.click("header button:has(div)");
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");

    // Login as Invited Sales Rep
    await page.fill('input[type="email"]', repEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    // Sales Rep goes to Settings
    await page.goto("http://localhost:5173/settings");

    // Sales Rep should NOT see the "Invite" button
    const inviteButtonRep = page.locator('button:has-text("Invite")');
    await expect(inviteButtonRep).not.toBeVisible();

    // Cleanup / Logout
    await page.click("header button:has(div)");
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");
  });
});
