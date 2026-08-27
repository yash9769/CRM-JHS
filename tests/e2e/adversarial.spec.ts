import { test, expect } from "@playwright/test";

test.describe("Adversarial E2E & Responsive Suite", () => {
  const timestamp = Date.now();
  const companyName = `Adv E2E Corp ${timestamp}`;
  const userEmail = `adv_e2e_${timestamp}@example.com`;
  const password = "Password123!";

  const accountName = `ADV_Acc_${timestamp}`;
  const oppName = `ADV_Lost_Opp_${timestamp}`;

  test("Closed Lost Deal E2E Workflow & Won Deals Exclusion", async ({ page }) => {
    // 1. Register & Login
    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Adv");
    await page.fill('input[name="lastName"]', "Tester");
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    // 2. Create Account
    await page.goto("http://localhost:5173/accounts");
    await page.locator('button:has-text("New Account")').first().click();
    await page.fill('input[name="name"]', accountName);
    await page.click('button:has-text("Create Account")');
    await expect(page.locator("table")).toContainText(accountName);

    // 3. Create Opportunity
    await page.goto("http://localhost:5173/pipeline");
    await page.click("text=New Opportunity");
    await page.fill('input[placeholder="CRM Implementation"]', oppName);
    const selects = page.locator("form select");
    await selects.nth(0).selectOption({ label: accountName });
    await page.fill('input[placeholder="120000"]', "300000");
    await selects.nth(2).selectOption({ index: 1 });
    await page.click('button:has-text("Create Opportunity")');
    await expect(page.locator("main")).toContainText(oppName);

    // 4. Convert to Deal
    await page.click(`text=${oppName}`);
    await page.click("text=Convert to Deal");
    await page.click('.fixed button:has-text("Convert to Deal")');
    await expect(page).toHaveURL(/\/deals\/.+/);

    // 5. Mark Deal as Closed Lost
    await page.click("text=Mark Lost");

    // Verify Closed Lost badge appears on detail page
    await expect(page.locator("main")).toContainText("Closed Lost");

    // 6. Navigate to Won Deals page & verify Closed Lost deal is NOT present
    await page.goto("http://localhost:5173/deals?won=true");
    await expect(page.locator("h1")).toContainText("Won Deals");
    await expect(page.locator("body")).not.toContainText(oppName);
  });

  const viewports = [
    { width: 375, height: 812, name: "Mobile Small (375x812)" },
    { width: 390, height: 844, name: "Mobile Medium (390x844)" },
    { width: 768, height: 1024, name: "Tablet Portrait (768x1024)" },
    { width: 1440, height: 900, name: "Desktop Wide (1440x900)" },
  ];

  for (const vp of viewports) {
    test(`Responsive Viewport Layout Check — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:5173/login");
      await page.fill('input[type="email"]', userEmail);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("http://localhost:5173/");

      // Check Dashboard loads cleanly without breaking
      await expect(page.locator("body")).toContainText("Here's where your pipeline stands today");

      // Check Accounts page layout
      await page.goto("http://localhost:5173/accounts");
      await expect(page.locator("h1")).toContainText("Accounts");
    });
  }
});
