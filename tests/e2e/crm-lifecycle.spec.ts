import { test, expect } from "@playwright/test";

test.describe("CRM Complete Lifecycle E2E", () => {
  const timestamp = Date.now();
  const companyName = `E2E Corp ${timestamp}`;
  const userEmail = `e2e_user_${timestamp}@example.com`;
  const password = "Password123!";

  const accountName = `TEST_Account_${timestamp}`;
  const contactName = `TEST_Contact_${timestamp}`;
  const oppName = `TEST_Opportunity_${timestamp}`;

  test("Complete CRM Lifecycle: Register -> Account -> Contact -> Opp -> Convert -> Closed Won -> Dashboard -> Refresh -> Logout/Login Persistence", async ({ page }) => {
    // 1. Register
    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "E2E");
    await page.fill('input[name="lastName"]', "Tester");
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Verify redirected to Dashboard
    await expect(page).toHaveURL("http://localhost:5173/");
    await expect(page.locator("body")).toContainText("Here's where your pipeline stands today");

    // 2. Create Account
    await page.goto("http://localhost:5173/accounts");
    await page.click("text=New Account");
    await page.fill('input[placeholder="Acme Technologies"]', accountName);
    await page.click('button:has-text("Create Account")');

    // Verify account in list
    await expect(page.locator("table")).toContainText(accountName);

    // 3. Create Contact
    await page.goto("http://localhost:5173/contacts");
    await page.click("text=New Contact");
    await page.fill('input[name="firstName"]', contactName);
    await page.fill('input[name="lastName"]', "Person");
    await page.fill('input[name="email"]', `contact_${timestamp}@example.com`);
    await page.selectOption('select[name="accountId"]', { label: accountName });
    await page.click('button:has-text("Create Contact")');

    // Verify contact created
    await expect(page.locator("table")).toContainText(contactName);

    // 4. Create Opportunity
    await page.goto("http://localhost:5173/pipeline");
    await page.click("text=New Opportunity");
    await page.fill('input[placeholder="CRM Implementation"]', oppName);
    
    // Select Account & Owner dropdowns
    const selects = page.locator("form select");
    await selects.nth(0).selectOption({ label: accountName });
    await page.fill('input[placeholder="120000"]', "500000");
    await selects.nth(2).selectOption({ index: 1 }); // Owner dropdown
    await page.click('button:has-text("Create Opportunity")');

    // Verify Opportunity card appears on Kanban
    await expect(page.locator("main")).toContainText(oppName);

    // 5. Open Opportunity Detail Page & Convert to Deal
    await page.click(`text=${oppName}`);
    await expect(page.locator("h1")).toContainText(oppName);
    await expect(page.locator("main")).toContainText("500,000");

    // Click Convert to Deal to open modal
    await page.click("text=Convert to Deal");
    
    // Click Convert button inside modal
    await page.click('.fixed button:has-text("Convert to Deal")');

    // Verify redirected to Deal Detail Page
    await expect(page).toHaveURL(/\/deals\/.+/);
    await expect(page.locator("h1")).toContainText(oppName);

    // 6. Mark Deal as Closed Won
    await page.click("text=Mark Won");

    // Verify Closed Won badge appears
    await expect(page.locator("main")).toContainText("Closed Won");

    // 7. Verify Won Deals Page
    await page.goto("http://localhost:5173/deals?won=true");
    await expect(page.locator("h1")).toContainText("Won Deals");
    await expect(page.locator("table")).toContainText(oppName);
    await expect(page.locator("table")).toContainText("500,000");

    // 8. Verify Dashboard Metrics
    await page.goto("http://localhost:5173/");
    await expect(page.locator("main")).toContainText("500,000");

    // 9. Hard Refresh & Verify Persistence
    await page.reload();
    await expect(page.locator("main")).toContainText("500,000");

    // 10. Logout & Login Persistence
    await page.click("header button:has(div)"); // Open user menu in header
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");

    await page.fill('input[type="email"]', userEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");
    await expect(page.locator("main")).toContainText("500,000");

    // Check accounts page again after relogin
    await page.goto("http://localhost:5173/accounts");
    await expect(page.locator("table")).toContainText(accountName);
  });
});
