import { buildApp } from "../../backend/src/app.js";
import { prisma } from "../../backend/src/lib/prisma.js";

interface TestResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log("=================================================");
  console.log("  LEDGER CRM — AUTOMATED API & LOGIC TEST SUITE  ");
  console.log("=================================================\n");

  const app = await buildApp();

  let adminToken = "";
  let adminUserId = "";
  let tenantId = "";

  let secondTenantToken = "";
  let secondTenantId = "";

  let testAccountId = "";
  let testContactId = "";
  let testOpportunityId = "";
  let testDealId = "";
  let testPipelineId = "";
  let testStageId = "";
  let dealPipelineId = "";
  let dealStageId = "";
  let dealClosedWonStageId = "";
  let dealClosedLostStageId = "";
  let createdUserIdToDev = "";

  async function test(id: string, category: string, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ id, category, name, passed: true });
      console.log(`[PASS] [${id}] ${category}: ${name}`);
    } catch (err: any) {
      results.push({ id, category, name, passed: false, error: err.message });
      console.error(`[FAIL] [${id}] ${category}: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // --- AUTH TESTS ---
  await test("AUTH-001", "Authentication", "Register new tenant & Admin user", async () => {
    const email = `test_admin_${Date.now()}@example.com`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        companyName: "QA Test Corp",
        firstName: "QA",
        lastName: "Admin",
        email,
        password: "Password123!",
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(!!body.token, "Token should be returned");
    assert(body.user.role === "ADMIN" || body.user.orgRole === "SENIOR_PARTNER", "Role should be ADMIN or SENIOR_PARTNER");
    adminToken = body.token;
    adminUserId = body.user.id;
    tenantId = body.tenant.id;
  });

  await test("AUTH-002", "Authentication", "Login with valid credentials", async () => {
    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(meRes.statusCode === 200, `Expected 200, got ${meRes.statusCode}`);
    const email = meRes.json().user.email;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "Password123!" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(!!res.json().token, "Token should be returned on login");
  });

  await test("AUTH-003", "Authentication", "Login with invalid password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "fake_user@example.com", password: "wrongpassword" },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  await test("AUTH-004", "Authentication", "Access protected endpoint without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/accounts",
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // --- ACCOUNTS TESTS ---
  await test("ACC-001", "Accounts", "Create valid account", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "TEST_Account_001",
        industry: "Technology",
        annualRevenue: 100000,
        phone: "+19999999999",
        website: "https://testaccount001.com",
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const body = res.json();
    assert(body.name === "TEST_Account_001", "Account name match");
    testAccountId = body.id;
  });

  await test("ACC-002", "Accounts", "Read account list with search & pagination", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/accounts?search=TEST_Account&page=1&pageSize=10",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const body = res.json();
    assert(body.data.length >= 1, "Should find at least 1 account");
    assert(body.pagination.total >= 1, "Pagination total should be >= 1");
  });

  await test("ACC-003", "Accounts", "Read account details by ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/accounts/${testAccountId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.json().id === testAccountId, "ID mismatch");
  });

  await test("ACC-004", "Accounts", "Update account fields", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/accounts/${testAccountId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { industry: "Software & Financial Tech" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.json().industry === "Software & Financial Tech", "Updated industry mismatch");
  });

  await test("ACC-005", "Accounts", "Account validation (empty name)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "" },
    });
    assert(res.statusCode === 400, `Expected 400 validation error, got ${res.statusCode}: ${res.body}`);
  });

  // --- CONTACTS TESTS ---
  await test("CON-001", "Contacts", "Create valid contact linked to account", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/contacts",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        firstName: "TEST_Contact_001",
        lastName: "Tester",
        email: "testcontact001@example.com",
        phone: "+19876543210",
        jobTitle: "VP of Engineering",
        accountId: testAccountId,
        lifecycleStage: "LEAD",
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const body = res.json();
    assert(body.accountId === testAccountId, "Account association mismatch");
    testContactId = body.id;
  });

  await test("CON-002", "Contacts", "Read contact details and relationship", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/contacts/${testContactId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.json().account.id === testAccountId, "Associated account mismatch");
  });

  await test("CON-003", "Contacts", "Contact validation (invalid email format)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/contacts",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { firstName: "Bad", lastName: "Email", email: "invalid-email-format" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}: ${res.body}`);
  });

  // --- OPPORTUNITY & DEAL TESTS ---
  await test("OPP-001", "Opportunities", "Fetch pipeline & stages", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pipelines?type=OPPORTUNITY",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const oppPipelines = res.json().data;
    assert(oppPipelines.length > 0, "Default opportunity pipeline should exist");
    testPipelineId = oppPipelines[0].id;
    testStageId = oppPipelines[0].stages[0].id;

    const dealPipRes = await app.inject({
      method: "GET",
      url: "/api/v1/pipelines?type=DEAL",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const dealPipelines = dealPipRes.json().data;
    dealPipelineId = dealPipelines[0].id;
    dealStageId = dealPipelines[0].stages[0].id;
    const wonStage = dealPipelines[0].stages.find((s: any) => s.isClosed && s.isWon);
    const lostStage = dealPipelines[0].stages.find((s: any) => s.isClosed && !s.isWon);
    dealClosedWonStageId = wonStage.id;
    dealClosedLostStageId = lostStage.id;
  });

  await test("OPP-002", "Opportunities", "Create valid opportunity", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "TEST_Opportunity_001",
        accountId: testAccountId,
        amount: 500000,
        pipelineId: testPipelineId,
        stageId: testStageId,
        ownerId: adminUserId,
        contactIds: [testContactId],
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(Number(body.amount) === 500000, "Amount mismatch");
    testOpportunityId = body.id;
  });

  await test("OPP-003", "Opportunities", "Convert Opportunity to Deal (Lifecycle Test)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/${testOpportunityId}/convert`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        dealPipelineId,
        dealStageId,
        closeDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
    const deal = res.json();
    assert(deal.opportunityId === testOpportunityId, "Originating opportunity link mismatch");
    assert(Number(deal.amount) === 500000, "Deal amount carried over");
    testDealId = deal.id;

    // Verify opportunity is marked as converted
    const oppRes = await app.inject({
      method: "GET",
      url: `/api/v1/opportunities/${testOpportunityId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(oppRes.json().isConverted === true, "Opportunity isConverted flag should be true");
  });

  await test("DEAL-001", "Deals", "Add product line items to Deal", async () => {
    // First create a product
    const prodRes = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "TEST_Product_Enterprise",
        sku: "PROD-001",
        unitPrice: 250000,
        currency: "INR",
      },
    });
    assert(prodRes.statusCode === 201, `Expected 201, got ${prodRes.statusCode}`);
    const productId = prodRes.json().id;

    // Add line item
    const itemRes = await app.inject({
      method: "POST",
      url: `/api/v1/deals/${testDealId}/line-items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        productId,
        quantity: 2,
        discountPct: 0,
      },
    });
    assert(itemRes.statusCode === 201, `Expected 201, got ${itemRes.statusCode}: ${itemRes.body}`);

    // Verify deal total recomputed to 500,000
    const dealRes = await app.inject({
      method: "GET",
      url: `/api/v1/deals/${testDealId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(Number(dealRes.json().amount) === 500000, "Deal amount should be recomputed to 500000");
  });

  await test("DEAL-002", "Deals", "Mark Deal as Closed Won (Business Rule Test)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/deals/${testDealId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        stageId: dealClosedWonStageId,
        pipelineId: dealPipelineId,
        closeDate: new Date().toISOString(),
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.forecastCategory === "CLOSED_WON", "Forecast category should be CLOSED_WON");
    assert(!!body.wonDate, "wonDate should be populated");
  });

  await test("DASH-001", "Dashboard", "Verify Dashboard metrics & won revenue", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const kpis = res.json().kpis;
    assert(kpis.closedWonRevenue >= 500000, `Closed Won Revenue should be >= 500000, got ${kpis.closedWonRevenue}`);
  });

  // --- MULTI-TENANCY & RBAC TESTS ---
  await test("SEC-001", "Security & Multi-Tenancy", "Create Second Tenant & Verify Cross-Tenant Isolation", async () => {
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        companyName: "Second Tenant Corp",
        firstName: "Other",
        lastName: "Admin",
        email: `other_admin_${Date.now()}@example.com`,
        password: "Password123!",
      },
    });
    secondTenantToken = regRes.json().token;
    secondTenantId = regRes.json().tenant.id;

    // Try accessing account from Tenant 1 using Tenant 2 token
    const isoRes = await app.inject({
      method: "GET",
      url: `/api/v1/accounts/${testAccountId}`,
      headers: { authorization: `Bearer ${secondTenantToken}` },
    });
    assert(isoRes.statusCode === 404, `Expected 404 for cross-tenant record access, got ${isoRes.statusCode}`);
  });

  await test("SEC-002", "Security & RBAC", "Non-admin cannot invite users", async () => {
    // Invite a sales rep user into Tenant 1
    const invRes = await app.inject({
      method: "POST",
      url: "/api/v1/users/invite",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: `sales_rep_${Date.now()}@example.com`,
        firstName: "Rep",
        lastName: "Sales",
        role: "SALES_REP",
        password: "Password123!",
      },
    });
    assert(invRes.statusCode === 201, `Expected 201, got ${invRes.statusCode}`);
    const repEmail = invRes.json().email;
    createdUserIdToDev = invRes.json().id;

    // Login as sales rep
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: repEmail, password: "Password123!" },
    });
    const repToken = loginRes.json().token;

    // Rep attempts to invite another user
    const failInvRes = await app.inject({
      method: "POST",
      url: "/api/v1/users/invite",
      headers: { authorization: `Bearer ${repToken}` },
      payload: {
        email: `another_${Date.now()}@example.com`,
        firstName: "Failing",
        lastName: "User",
        role: "SALES_REP",
        password: "Password123!",
      },
    });
    assert(failInvRes.statusCode === 403, `Expected 403 Forbidden for non-admin invite, got ${failInvRes.statusCode}`);
  });

  // --- USER DELETION TEST (Bug #2 check) ---
  await test("USER-001", "User Management", "Delete user with owned records or roles", async () => {
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/users/${createdUserIdToDev}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(delRes.statusCode === 204, `Expected 204, got ${delRes.statusCode}: ${delRes.body}`);
  });

  // --- QUOTES TESTS ---
  await test("QUOTE-001", "Quotes", "Create, Read, Update status of Quote", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/quotes",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        dealId: testDealId,
        accountId: testAccountId,
        discountPct: 5,
        taxPct: 10,
      },
    });
    assert(createRes.statusCode === 201, `Expected 201, got ${createRes.statusCode}: ${createRes.body}`);
    const quoteId = createRes.json().id;

    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/quotes/${quoteId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(getRes.statusCode === 200, `Expected 200, got ${getRes.statusCode}`);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/quotes/${quoteId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: "SENT" },
    });
    assert(patchRes.statusCode === 200, `Expected 200, got ${patchRes.statusCode}`);
    assert(patchRes.json().status === "SENT", "Status should be SENT");
  });

  // --- REPORTS TESTS ---
  await test("REP-001", "Reports", "Verify Pipeline Health, Owner Performance, Win/Loss, Funnel reports", async () => {
    const r1 = await app.inject({ method: "GET", url: "/api/v1/reports/pipeline-health", headers: { authorization: `Bearer ${adminToken}` } });
    assert(r1.statusCode === 200, `Expected 200 for pipeline-health, got ${r1.statusCode}`);

    const r2 = await app.inject({ method: "GET", url: "/api/v1/reports/owner-performance", headers: { authorization: `Bearer ${adminToken}` } });
    assert(r2.statusCode === 200, `Expected 200 for owner-performance, got ${r2.statusCode}`);

    const r3 = await app.inject({ method: "GET", url: "/api/v1/reports/win-loss", headers: { authorization: `Bearer ${adminToken}` } });
    assert(r3.statusCode === 200, `Expected 200 for win-loss, got ${r3.statusCode}`);

    const r4 = await app.inject({ method: "GET", url: "/api/v1/reports/conversion-funnel", headers: { authorization: `Bearer ${adminToken}` } });
    assert(r4.statusCode === 200, `Expected 200 for conversion-funnel, got ${r4.statusCode}`);
  });

  // --- SEARCH & PROPERTIES TESTS ---
  await test("SEARCH-001", "Global Search", "Search accounts, contacts, opportunities, deals", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=TEST",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  });

  // Print Summary
  console.log("\n=================================================");
  console.log("             TEST EXECUTION SUMMARY              ");
  console.log("=================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Executed: ${results.length}`);
  console.log(`Passed:         ${passedCount}`);
  console.log(`Failed:         ${failedCount}`);
  console.log("=================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
