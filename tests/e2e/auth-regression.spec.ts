import { test, expect } from "@playwright/test";

test.describe("Authentication Regression", () => {
  test.setTimeout(60000);

  test("AUTH-001: Fresh registration -> Dashboard", async ({ page }) => {
    const timestamp = Date.now();
    const companyName = `AuthReg ${timestamp}`;
    const email = `authreg_${timestamp}@example.com`;
    const password = "Password123!";

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Auth");
    await page.fill('input[name="lastName"]', "Reg");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");
    await expect(page.locator("body")).toContainText("Here's where your pipeline stands today");
  });

  test("AUTH-001b: Registration -> Accounts -> Create Account", async ({ page }) => {
    const timestamp = Date.now();
    const companyName = `ColdReg ${timestamp}`;
    const email = `coldreg_${timestamp}@example.com`;
    const password = "Password123!";
    const accountName = `ColdReg Account ${timestamp}`;

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Cold");
    await page.fill('input[name="lastName"]', "Reg");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    await page.goto("http://localhost:5173/accounts");
    await page.click("text=New Account");
    await page.fill('input[name="name"]', accountName);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await expect(page.locator("table")).toContainText(accountName);
  });

  test("AUTH-002: Invalid registration -> error", async ({ page }) => {
    const timestamp = Date.now();
    const companyName = `DupReg ${timestamp}`;
    const email = `dupreg_${timestamp}@example.com`;
    const password = "Password123!";

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Dup");
    await page.fill('input[name="lastName"]', "Reg");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', companyName);
    await page.fill('input[name="firstName"]', "Dup");
    await page.fill('input[name="lastName"]', "Reg");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page.locator("body")).toContainText("Email already in use");
  });

  test("AUTH-003: Valid login -> Dashboard", async ({ page }) => {
    const timestamp = Date.now();
    const email = `loginreg_${timestamp}@example.com`;
    const password = "Password123!";

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', `LoginReg ${timestamp}`);
    await page.fill('input[name="firstName"]', "Login");
    await page.fill('input[name="lastName"]', "Reg");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    await page.click("header button:has(div)");
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");
    await expect(page.locator("body")).toContainText("Here's where your pipeline stands today");
  });

  test("AUTH-004: Invalid login -> error", async ({ page }) => {
    const timestamp = Date.now();
    const email = `invlogin_${timestamp}@example.com`;
    const password = "Password123!";

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', `InvLogin ${timestamp}`);
    await page.fill('input[name="firstName"]', "Inv");
    await page.fill('input[name="lastName"]', "Login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    await page.click("header button:has(div)");
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "WrongPassword");
    await page.click('button[type="submit"]');

    await expect(page.locator("body")).toContainText("Invalid credentials");
  });

  test("AUTH-005: Authenticated dashboard -> refresh -> still authenticated", async ({ page }) => {
    const timestamp = Date.now();
    const email = `refresh_${timestamp}@example.com`;
    const password = "Password123!";

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', `Refresh ${timestamp}`);
    await page.fill('input[name="firstName"]', "Refresh");
    await page.fill('input[name="lastName"]', "Test");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    await page.reload();
    await expect(page).toHaveURL("http://localhost:5173/");
    await expect(page.locator("body")).toContainText("Here's where your pipeline stands today");
  });

  test("AUTH-006: Unauthenticated /accounts -> Login", async ({ page }) => {
    await page.goto("http://localhost:5173/accounts");
    await expect(page).toHaveURL("http://localhost:5173/login");
  });

  test("AUTH-007: Logout -> protected routes blocked", async ({ page }) => {
    const timestamp = Date.now();
    const email = `logout_${timestamp}@example.com`;
    const password = "Password123!";

    await page.goto("http://localhost:5173/register");
    await page.fill('input[name="companyName"]', `Logout ${timestamp}`);
    await page.fill('input[name="firstName"]', "Logout");
    await page.fill('input[name="lastName"]', "Test");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL("http://localhost:5173/");

    await page.click("header button:has(div)");
    await page.click("text=Sign out");
    await expect(page).toHaveURL("http://localhost:5173/login");

    await page.goto("http://localhost:5173/accounts");
    await expect(page).toHaveURL("http://localhost:5173/login");
  });
});
