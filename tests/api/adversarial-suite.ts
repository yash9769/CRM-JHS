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

async function runAdversarialSuite() {
  console.log("=================================================");
  console.log("   LEDGER CRM — ADVERSARIAL API QA TEST SUITE    ");
  console.log("=================================================\n");

  const app = await buildApp();

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

  // Global Context Setup
  let tenantAToken = "";
  let tenantAId = "";
  let adminUserId = "";

  let tenantBToken = "";
  let tenantBId = "";

  let accountAId = "";
  let contactAId = "";
  let oppAId = "";
  let dealAId = "";
  let productAId = "";
  let quoteAId = "";

  let oppPipelineId = "";
  let oppStageId = "";
  let dealPipelineId = "";
  let dealStageProposalId = "";
  let dealClosedWonStageId = "";
  let dealClosedLostStageId = "";

  // 1. SETUP TENANTS
  await test("ADV-SETUP-01", "Setup", "Create Tenant A (Admin)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        companyName: "Adversarial Tenant A",
        firstName: "Alice",
        lastName: "Admin",
        email: `tenant_a_${Date.now()}@example.com`,
        password: "Password123!",
      },
    });
    assert(res.statusCode === 201, `Failed to register Tenant A: ${res.body}`);
    const b = res.json();
    tenantAToken = b.token;
    tenantAId = b.tenant.id;
    adminUserId = b.user.id;

    // Fetch Pipelines
    const pipRes = await app.inject({
      method: "GET",
      url: "/api/v1/pipelines?type=OPPORTUNITY",
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    const oppPips = pipRes.json().data;
    oppPipelineId = oppPips[0].id;
    oppStageId = oppPips[0].stages[0].id;

    const dealPipRes = await app.inject({
      method: "GET",
      url: "/api/v1/pipelines?type=DEAL",
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    const dealPips = dealPipRes.json().data;
    dealPipelineId = dealPips[0].id;
    dealStageProposalId = dealPips[0].stages.find((s: any) => s.name === "Proposal").id;
    dealClosedWonStageId = dealPips[0].stages.find((s: any) => s.isClosed && s.isWon).id;
    dealClosedLostStageId = dealPips[0].stages.find((s: any) => s.isClosed && !s.isWon).id;
  });

  await test("ADV-SETUP-02", "Setup", "Create Tenant B (Attacker)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        companyName: "Adversarial Tenant B",
        firstName: "Bob",
        lastName: "Attacker",
        email: `tenant_b_${Date.now()}@example.com`,
        password: "Password123!",
      },
    });
    assert(res.statusCode === 201, `Failed to register Tenant B: ${res.body}`);
    const b = res.json();
    tenantBToken = b.token;
    tenantBId = b.tenant.id;
  });

  // 2. OPPORTUNITY FIELD BOUNDARIES & NEGATIVE TESTS
  await test("ADV-FIELD-01", "Opportunity Boundaries", "Reject negative amount (-1)", async () => {
    // Create valid Account first
    const accRes = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { name: "Boundary Account A" },
    });
    accountAId = accRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: "Negative Amount Opp",
        accountId: accountAId,
        amount: -1,
        pipelineId: oppPipelineId,
        stageId: oppStageId,
        ownerId: adminUserId,
      },
    });
    assert(res.statusCode === 400, `Expected 400 Bad Request, got ${res.statusCode}`);
  });

  await test("ADV-FIELD-02", "Opportunity Boundaries", "Reject zero amount (0)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: "Zero Amount Opp",
        accountId: accountAId,
        amount: 0,
        pipelineId: oppPipelineId,
        stageId: oppStageId,
        ownerId: adminUserId,
      },
    });
    assert(res.statusCode === 400, `Expected 400 Bad Request, got ${res.statusCode}`);
  });

  await test("ADV-FIELD-03", "Opportunity Boundaries", "Accept valid minimum amount (1)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: "Min Amount Opp",
        accountId: accountAId,
        amount: 1,
        pipelineId: oppPipelineId,
        stageId: oppStageId,
        ownerId: adminUserId,
      },
    });
    assert(res.statusCode === 201, `Expected 201 Created, got ${res.statusCode}`);
  });

  await test("ADV-FIELD-04", "Opportunity Boundaries", "Accept extremely large amount (999,999,999)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: "Large Amount Opp",
        accountId: accountAId,
        amount: 999999999,
        pipelineId: oppPipelineId,
        stageId: oppStageId,
        ownerId: adminUserId,
      },
    });
    assert(res.statusCode === 201, `Expected 201 Created, got ${res.statusCode}`);
    assert(Number(res.json().amount) === 999999999, "Amount mismatch");
  });

  await test("ADV-FIELD-05", "Opportunity Boundaries", "Reject probability outside 0-100", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: "Bad Probability Opp",
        accountId: accountAId,
        amount: 1000,
        pipelineId: oppPipelineId,
        stageId: oppStageId,
        probability: 150,
        ownerId: adminUserId,
      },
    });
    assert(res.statusCode === 400, `Expected 400 Bad Request, got ${res.statusCode}`);
  });

  // 3. INDEPENDENT CRUD OPERATIONS (Accounts, Contacts, Opps, Deals, Products, Quotes)
  await test("ADV-CRUD-01", "Independent CRUD", "Account CRUD (Create, Read, Update, Delete)", async () => {
    // Create
    const cRes = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { name: "CRUD Temp Account" },
    });
    assert(cRes.statusCode === 201, `Create failed: ${cRes.statusCode}`);
    const tempId = cRes.json().id;

    // Read
    const rRes = await app.inject({
      method: "GET",
      url: `/api/v1/accounts/${tempId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert(rRes.statusCode === 200, `Read failed: ${rRes.statusCode}`);

    // Update
    const uRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/accounts/${tempId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { domain: "updated.com" },
    });
    assert(uRes.statusCode === 200, `Update failed: ${uRes.statusCode}`);

    // Delete
    const dRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/accounts/${tempId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert(dRes.statusCode === 204, `Delete failed: ${dRes.statusCode}`);
  });

  await test("ADV-CRUD-02", "Independent CRUD", "Contact CRUD (Create, Read, Update, Delete)", async () => {
    // Create Contact
    const cRes = await app.inject({
      method: "POST",
      url: "/api/v1/contacts",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { firstName: "Jane", lastName: "Doe", accountId: accountAId, email: "jane.doe@example.com" },
    });
    assert(cRes.statusCode === 201, `Create contact failed: ${cRes.statusCode}`);
    contactAId = cRes.json().id;

    // Read
    const rRes = await app.inject({
      method: "GET",
      url: `/api/v1/contacts/${contactAId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert(rRes.statusCode === 200, `Read contact failed: ${rRes.statusCode}`);

    // Update
    const uRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/contacts/${contactAId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { jobTitle: "Chief Technology Officer" },
    });
    assert(uRes.statusCode === 200, `Update contact failed: ${uRes.statusCode}`);

    // Delete (create temp contact to delete)
    const tempContactRes = await app.inject({
      method: "POST",
      url: "/api/v1/contacts",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { firstName: "Temp", lastName: "Delete", email: "temp.del@example.com" },
    });
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/contacts/${tempContactRes.json().id}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert(delRes.statusCode === 204, `Delete contact failed: ${delRes.statusCode}`);
  });

  // 4. CLOSED WON & CLOSED LOST WORKFLOW + WON DEALS PERSISTENCE
  await test("ADV-LIFE-01", "Opportunity Lifecycle", "Opportunity -> Deal -> Closed Won Lifecycle", async () => {
    // 1. Create Opp
    const oppRes = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: "Won Lifecycle Opportunity",
        accountId: accountAId,
        amount: 250000,
        pipelineId: oppPipelineId,
        stageId: oppStageId,
        ownerId: adminUserId,
      },
    });
    oppAId = oppRes.json().id;

    // 2. Convert to Deal
    const convRes = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/${oppAId}/convert`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { dealPipelineId, dealStageId: dealStageProposalId },
    });
    assert(convRes.statusCode === 201, `Convert to deal failed: ${convRes.statusCode}`);
    dealAId = convRes.json().id;

    // 3. Mark Deal as Closed Won
    const wonRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/deals/${dealAId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { stageId: dealClosedWonStageId },
    });
    assert(wonRes.statusCode === 200, `Mark won failed: ${wonRes.statusCode}`);
    assert(wonRes.json().forecastCategory === "CLOSED_WON", "Forecast category is CLOSED_WON");

    // 4. Verify in Won Deals list endpoint
    const dealsRes = await app.inject({
      method: "GET",
      url: "/api/v1/deals?stageId=" + dealClosedWonStageId,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    assert(dealsRes.statusCode === 200, `Fetch won deals failed: ${dealsRes.statusCode}`);
    const found = dealsRes.json().data.some((d: any) => d.id === dealAId);
    assert(found, "Won deal must appear in won deals list");
  });

  await test("ADV-LIFE-02", "Opportunity Lifecycle", "Closed Lost Deal stays OUT of Won Deals list", async () => {
    // Create Opp
    const oppRes = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: {
        name: "Lost Lifecycle Opportunity",
        accountId: accountAId,
        amount: 150000,
        pipelineId: oppPipelineId,
        stageId: oppStageId,
        ownerId: adminUserId,
      },
    });
    const lostOppId = oppRes.json().id;

    // Convert to Deal
    const convRes = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/${lostOppId}/convert`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { dealPipelineId, dealStageId: dealStageProposalId },
    });
    const lostDealId = convRes.json().id;

    // Mark Deal as Closed Lost
    const lostRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/deals/${lostDealId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { stageId: dealClosedLostStageId },
    });
    assert(lostRes.statusCode === 200, `Mark lost failed: ${lostRes.statusCode}`);
    assert(lostRes.json().forecastCategory === "CLOSED_LOST", "Forecast category is CLOSED_LOST");

    // Verify Lost Deal DOES NOT appear in Closed Won Stage list
    const wonDealsRes = await app.inject({
      method: "GET",
      url: "/api/v1/deals?stageId=" + dealClosedWonStageId,
      headers: { authorization: `Bearer ${tenantAToken}` },
    });
    const inWonList = wonDealsRes.json().data.some((d: any) => d.id === lostDealId);
    assert(!inWonList, "Closed Lost deal MUST NOT appear in Won Deals list!");
  });

  // 5. CONTROLLED DASHBOARD MATHEMATICS VERIFICATION
  await test("ADV-MATH-01", "Dashboard Math", "Controlled dataset KPI calculations ($100k, $200k, $300k, $400k)", async () => {
    // Register dedicated fresh tenant for clean math
    const mathReg = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        companyName: "Math Test Corp",
        firstName: "Math",
        lastName: "Tester",
        email: `math_${Date.now()}@example.com`,
        password: "Password123!",
      },
    });
    const mToken = mathReg.json().token;
    const mUserId = mathReg.json().user.id;

    // Create Account
    const mAcc = await app.inject({
      method: "POST",
      url: "/api/v1/accounts",
      headers: { authorization: `Bearer ${mToken}` },
      payload: { name: "Math Account" },
    });
    const mAccId = mAcc.json().id;

    // Get Deal Pipeline & Stages
    const mPipRes = await app.inject({
      method: "GET",
      url: "/api/v1/pipelines?type=DEAL",
      headers: { authorization: `Bearer ${mToken}` },
    });
    const mPips = mPipRes.json().data;
    const mPipId = mPips[0].id;
    const mOpenStage = mPips[0].stages.find((s: any) => !s.isClosed); // Stage 1 (prob 50%)
    const mWonStage = mPips[0].stages.find((s: any) => s.isClosed && s.isWon); // Closed Won
    const mLostStage = mPips[0].stages.find((s: any) => s.isClosed && !s.isWon); // Closed Lost

    // Deal A = 100,000 WON
    const dARes = await app.inject({
      method: "POST",
      url: "/api/v1/deals",
      headers: { authorization: `Bearer ${mToken}` },
      payload: { name: "Deal A", accountId: mAccId, amount: 100000, pipelineId: mPipId, stageId: mOpenStage.id, ownerId: mUserId },
    });
    await app.inject({
      method: "PATCH",
      url: `/api/v1/deals/${dARes.json().id}`,
      headers: { authorization: `Bearer ${mToken}` },
      payload: { stageId: mWonStage.id },
    });

    // Deal B = 200,000 WON
    const dBRes = await app.inject({
      method: "POST",
      url: "/api/v1/deals",
      headers: { authorization: `Bearer ${mToken}` },
      payload: { name: "Deal B", accountId: mAccId, amount: 200000, pipelineId: mPipId, stageId: mOpenStage.id, ownerId: mUserId },
    });
    await app.inject({
      method: "PATCH",
      url: `/api/v1/deals/${dBRes.json().id}`,
      headers: { authorization: `Bearer ${mToken}` },
      payload: { stageId: mWonStage.id },
    });

    // Deal C = 300,000 LOST
    const dCRes = await app.inject({
      method: "POST",
      url: "/api/v1/deals",
      headers: { authorization: `Bearer ${mToken}` },
      payload: { name: "Deal C", accountId: mAccId, amount: 300000, pipelineId: mPipId, stageId: mOpenStage.id, ownerId: mUserId },
    });
    await app.inject({
      method: "PATCH",
      url: `/api/v1/deals/${dCRes.json().id}`,
      headers: { authorization: `Bearer ${mToken}` },
      payload: { stageId: mLostStage.id },
    });

    // Deal D = 400,000 OPEN (Probability 50%)
    await app.inject({
      method: "POST",
      url: "/api/v1/deals",
      headers: { authorization: `Bearer ${mToken}` },
      payload: { name: "Deal D", accountId: mAccId, amount: 400000, pipelineId: mPipId, stageId: mOpenStage.id, ownerId: mUserId },
    });

    // Fetch Dashboard
    const dashRes = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
      headers: { authorization: `Bearer ${mToken}` },
    });
    assert(dashRes.statusCode === 200, `Dashboard failed: ${dashRes.statusCode}`);
    const kpis = dashRes.json().kpis;

    // Verify exact mathematical formulas
    assert(kpis.totalPipeline === 400000, `Expected totalPipeline 400,000, got ${kpis.totalPipeline}`);
    assert(kpis.weightedPipeline === 200000, `Expected weightedPipeline 200,000 (50% of 400k), got ${kpis.weightedPipeline}`);
    assert(kpis.closedWonRevenue === 300000, `Expected closedWonRevenue 300,000 (100k + 200k), got ${kpis.closedWonRevenue}`);
    assert(kpis.openDeals === 1, `Expected openDeals count 1, got ${kpis.openDeals}`);
    assert(kpis.avgDealSize === 150000, `Expected avgDealSize 150,000 (300k / 2 won), got ${kpis.avgDealSize}`);
    assert(Math.round(kpis.winRate * 100) === 67, `Expected winRate ~67% (2 won / 3 closed), got ${Math.round(kpis.winRate * 100)}%`);
  });

  // 6. MULTI-TENANCY CROSS-ORGANIZATION ISOLATION (IDOR)
  await test("ADV-SEC-01", "Multi-Tenancy", "Tenant B cannot access Tenant A Account (404/403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/accounts/${accountAId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert(res.statusCode === 404, `Expected 404 for cross-tenant Account GET, got ${res.statusCode}`);
  });

  await test("ADV-SEC-02", "Multi-Tenancy", "Tenant B cannot access Tenant A Contact (404/403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/contacts/${contactAId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert(res.statusCode === 404, `Expected 404 for cross-tenant Contact GET, got ${res.statusCode}`);
  });

  await test("ADV-SEC-03", "Multi-Tenancy", "Tenant B cannot access Tenant A Opportunity (404/403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/opportunities/${oppAId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert(res.statusCode === 404, `Expected 404 for cross-tenant Opportunity GET, got ${res.statusCode}`);
  });

  await test("ADV-SEC-04", "Multi-Tenancy", "Tenant B cannot access Tenant A Deal (404/403)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/deals/${dealAId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert(res.statusCode === 404, `Expected 404 for cross-tenant Deal GET, got ${res.statusCode}`);
  });

  await test("ADV-SEC-05", "Multi-Tenancy", "Tenant B cannot modify Tenant A Account (404/403)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/accounts/${accountAId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
      payload: { name: "Hacked Account Name" },
    });
    assert(res.statusCode === 404, `Expected 404 for cross-tenant Account PATCH, got ${res.statusCode}`);
  });

  await test("ADV-SEC-06", "Multi-Tenancy", "Tenant B cannot delete Tenant A Account (404/403)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/accounts/${accountAId}`,
      headers: { authorization: `Bearer ${tenantBToken}` },
    });
    assert(res.statusCode === 404, `Expected 404 for cross-tenant Account DELETE, got ${res.statusCode}`);
  });

  // 7. TRANSACTION SAFETY & DUPLICATE SUBMISSION GUARDS
  await test("ADV-SAFE-01", "Transaction Safety", "Cannot convert an already converted Opportunity", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/${oppAId}/convert`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { dealPipelineId, dealStageId: dealStageProposalId },
    });
    assert(res.statusCode === 400, `Expected 400 Bad Request for duplicate conversion, got ${res.statusCode}`);
  });

  await test("ADV-SAFE-02", "Transaction Safety", "Cannot edit a converted Opportunity", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/opportunities/${oppAId}`,
      headers: { authorization: `Bearer ${tenantAToken}` },
      payload: { name: "Attempted Name Edit" },
    });
    assert(res.statusCode === 400, `Expected 400 Bad Request for editing converted Opp, got ${res.statusCode}`);
  });

  // Print Summary
  console.log("\n=================================================");
  console.log("       ADVERSARIAL SUITE SUMMARY RESULTS        ");
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

runAdversarialSuite().catch((err) => {
  console.error("Fatal adversarial suite runner error:", err);
  process.exit(1);
});
