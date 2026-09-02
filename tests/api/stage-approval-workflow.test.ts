import { buildApp } from "../../backend/src/app.js";
import { prisma } from "../../backend/src/lib/prisma.js";

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function runStageApprovalTests() {
  console.log("==================================================================");
  console.log("   OPPORTUNITY STAGE APPROVAL WORKFLOW — END-TO-END TEST SUITE   ");
  console.log("==================================================================\n");

  const app = await buildApp();

  let tenantId = "";
  let spToken = "";
  let spUserId = "";

  let partnerToken = "";
  let partnerUserId = "";

  let managerToken = "";
  let managerUserId = "";

  let oppId = "";
  let demoStageId = "";
  let proposalStageId = "";
  let quoteStageId = "";
  let pipelineId = "";
  let accountId = "";

  let pendingApprovalId1 = "";
  let pendingApprovalId2 = "";

  async function test(num: number, name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ num, name, passed: true });
      console.log(`[PASS] Test ${num}: ${name}`);
    } catch (err: any) {
      results.push({ num, name, passed: false, error: err.message });
      console.error(`[FAIL] Test ${num}: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // --- SETUP ---
  console.log("--- Setting up test environment ---");

  // 1. Register Senior Partner (Creates Tenant)
  const spEmail = `sp_${Date.now()}@example.com`;
  const regRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      companyName: "Stage Approval Test Corp",
      firstName: "Senior",
      lastName: "Partner",
      email: spEmail,
      password: "Password123!",
    },
  });
  assert(regRes.statusCode === 201, `Register failed: ${regRes.body}`);
  const regBody = regRes.json();
  spToken = regBody.token;
  spUserId = regBody.user.id;
  tenantId = regBody.tenant.id;

  // Update SP role to SENIOR_PARTNER
  await prisma.user.update({
    where: { id: spUserId },
    data: { orgRole: "SENIOR_PARTNER" },
  });

  // 2. Create Partner User
  const partnerEmail = `partner_${Date.now()}@example.com`;
  const pUserRes = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    headers: { authorization: `Bearer ${spToken}` },
    payload: {
      email: partnerEmail,
      firstName: "Sales",
      lastName: "Partner",
      password: "Password123!",
      orgRole: "PARTNER",
    },
  });
  assert(pUserRes.statusCode === 201, `Create Partner failed: ${pUserRes.body}`);
  partnerUserId = pUserRes.json().id;

  // Login Partner to get Token
  const pLoginRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: partnerEmail, password: "Password123!" },
  });
  partnerToken = pLoginRes.json().token;

  // 3. Create Manager User reporting to Partner
  const managerEmail = `manager_${Date.now()}@example.com`;
  const mUserRes = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    headers: { authorization: `Bearer ${partnerToken}` },
    payload: {
      email: managerEmail,
      firstName: "Sales",
      lastName: "Manager",
      password: "Password123!",
      orgRole: "MANAGER",
      partnerId: partnerUserId,
    },
  });
  assert(mUserRes.statusCode === 201, `Create Manager failed: ${mUserRes.body}`);
  managerUserId = mUserRes.json().id;

  // Login Manager to get Token
  const mLoginRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: managerEmail, password: "Password123!" },
  });
  managerToken = mLoginRes.json().token;

  // 4. Fetch Pipeline & Stages
  const pipelineRes = await app.inject({
    method: "GET",
    url: "/api/v1/pipelines?type=OPPORTUNITY",
    headers: { authorization: `Bearer ${spToken}` },
  });
  assert(pipelineRes.statusCode === 200, `Fetch pipelines failed: ${pipelineRes.body}`);
  const pipelines = pipelineRes.json().data;
  assert(pipelines.length > 0, "No opportunity pipeline found");
  pipelineId = pipelines[0].id;

  const stages = pipelines[0].stages;
  demoStageId = stages.find((s: any) => s.name.toLowerCase().includes("demo") || s.name.toLowerCase().includes("scope"))?.id || stages[0].id;
  proposalStageId = stages.find((s: any) => s.name.toLowerCase().includes("proposal"))?.id || stages[1].id;
  quoteStageId = stages.find((s: any) => s.name.toLowerCase().includes("negotiation") || s.name.toLowerCase().includes("won"))?.id || stages[2].id;

  // 5. Create Test Account & Opportunity
  const accRes = await app.inject({
    method: "POST",
    url: "/api/v1/accounts",
    headers: { authorization: `Bearer ${managerToken}` },
    payload: { name: "Acme SOC Technologies", domain: "acme.com" },
  });
  assert(accRes.statusCode === 201, `Create Account failed: ${accRes.body}`);
  accountId = accRes.json().id;

  const oppRes = await app.inject({
    method: "POST",
    url: "/api/v1/opportunities",
    headers: { authorization: `Bearer ${managerToken}` },
    payload: {
      name: "Acme Cyber Security Retainer",
      accountId,
      amount: 1200000,
      pipelineId,
      stageId: demoStageId,
      ownerId: managerUserId,
    },
  });
  assert(oppRes.statusCode === 201, `Create Opportunity failed: ${oppRes.body}`);
  oppId = oppRes.json().id;

  console.log(`Environment Setup Complete:
  - Tenant ID: ${tenantId}
  - Opportunity ID: ${oppId} (Current Stage: Demo)\n`);

  // --- RUN 12 MANDATORY TEST CASES ---

  // Test 1: Manager Demo → Proposal (Approval request created, Stage remains Demo)
  await test(1, "Manager requests Demo -> Proposal transition", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { stageId: proposalStageId, remarks: "Demo completed successfully. Requesting Proposal approval." },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.pendingApproval === true, "Response should indicate pendingApproval: true");
    assert(body.stageId === demoStageId, "Opportunity stage MUST remain Demo!");
    assert(!!body.approval, "Stage approval record should be returned");
    assert(body.approval.status === "PENDING", "Approval status should be PENDING");

    pendingApprovalId1 = body.approval.id;
  });

  // Test 2: Partner Review Details
  await test(2, "Partner views pending approval details", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/opportunities/approvals/pending",
      headers: { authorization: `Bearer ${partnerToken}` },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const approvals = res.json().data;
    assert(approvals.length > 0, "Pending approvals list should contain at least 1 record");
    const target = approvals.find((a: any) => a.id === pendingApprovalId1);
    assert(!!target, "Target approval request should be in Partner queue");
    assert(target.opportunity.name === "Acme Cyber Security Retainer", "Opportunity details must match");
    assert(target.requestedBy.id === managerUserId, "Requester ID must match Manager");
  });

  // Test 3: Partner Disapprove Without Comment (Validation Error)
  await test(3, "Partner attempts to disapprove without comment", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/approvals/${pendingApprovalId1}/disapprove`,
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: { approverComment: "   " },
    });

    assert(res.statusCode === 400, `Expected 400 validation error, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.error.toLowerCase().includes("reason for disapproval is required"), `Expected comment required message, got: ${body.error}`);
  });

  // Test 4: Partner Disapprove With Comment
  await test(4, "Partner disapproves stage change with comment", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/approvals/${pendingApprovalId1}/disapprove`,
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: { approverComment: "Proposal amount requires pricing review before approval." },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.status === "DISAPPROVED", `Status should be DISAPPROVED, got ${body.status}`);
    assert(body.approverComment === "Proposal amount requires pricing review before approval.", "Approver comment should be stored");

    // Verify opportunity stage remains Demo
    const oppFetch = await app.inject({
      method: "GET",
      url: `/api/v1/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    assert(oppFetch.json().stageId === demoStageId, "Opportunity stage MUST remain Demo after disapproval");
  });

  // Test 5: Manager Request Again (New PENDING created, old remains DISAPPROVED)
  await test(5, "Manager requests stage change again after disapproval", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { stageId: proposalStageId, remarks: "Pricing updated per Partner guidance." },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.pendingApproval === true, "Response should indicate pendingApproval");
    assert(body.approval.id !== pendingApprovalId1, "New request ID should be created");
    assert(body.approval.status === "PENDING", "New request status should be PENDING");

    pendingApprovalId2 = body.approval.id;

    // Verify history contains both requests
    const historyRes = await app.inject({
      method: "GET",
      url: `/api/v1/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    const history = historyRes.json().stageApprovals;
    assert(history.length >= 2, "Stage approvals history should preserve past requests");
    const oldReq = history.find((h: any) => h.id === pendingApprovalId1);
    assert(oldReq.status === "DISAPPROVED", "Old request MUST remain DISAPPROVED");
  });

  // Test 6: Partner Approve (APPROVED status, stage moves Demo → Proposal)
  await test(6, "Partner approves stage change request", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/approvals/${pendingApprovalId2}/approve`,
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: { comments: "Approved! Pricing looks good." },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);

    // Verify opportunity stage moved to Proposal
    const oppFetch = await app.inject({
      method: "GET",
      url: `/api/v1/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    assert(oppFetch.json().stageId === proposalStageId, "Opportunity stage MUST be updated to Proposal after approval");
  });

  // Test 7: Direct API Bypass Block
  await test(7, "Manager direct API patch stage change to Quote", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/opportunities/${oppId}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { stageId: quoteStageId },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.pendingApproval === true, "Direct API update MUST NOT bypass approval");
    assert(body.stageId === proposalStageId, "Opportunity stage MUST remain Proposal");
  });

  // Test 8: CSV Import Protection
  await test(8, "CSV import requesting Quote stage creates pending approval", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities/import",
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        rows: [
          {
            "Opportunity Name": "CSV Imported Cyber Opp",
            Account: "Acme SOC Technologies",
            "Opportunity Value": "500000",
            Stage: "Negotiation",
          },
        ],
        mapping: {
          name: "Opportunity Name",
          account: "Account",
          amount: "Opportunity Value",
          opportunityStage: "Stage",
        },
        commit: true,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.summary.imported === 1, `Expected 1 imported, got ${body.summary.imported}`);
    assert(body.summary.pendingApproval === 1, `Expected 1 pendingApproval metric, got ${body.summary.pendingApproval}`);
  });

  // Test 9: Bulk Update Protection
  await test(9, "Bulk stage update creates individual approval requests", async () => {
    // Create a fresh opportunity without existing pending approval
    const freshOppRes = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: "Bulk Test Opportunity",
        accountId,
        amount: 350000,
        pipelineId,
        stageId: demoStageId,
        ownerId: managerUserId,
      },
    });
    const freshOppId = freshOppRes.json().id;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities/bulk",
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        ids: [freshOppId],
        action: "changeStage",
        stageId: quoteStageId,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.pendingApproval === 1, `Expected pendingApproval metric 1, got ${body.pendingApproval}`);
    assert(body.updated === 0, "Bulk action MUST NOT update stage directly");
  });

  // Test 10: Concurrent Approvals (Re-approving processed request fails)
  await test(10, "Re-approving already processed request fails", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/approvals/${pendingApprovalId2}/approve`,
      headers: { authorization: `Bearer ${spToken}` },
    });

    assert(res.statusCode === 400, `Expected 400 error for already processed request, got ${res.statusCode}: ${res.body}`);
    const body = res.json();
    assert(body.error.toLowerCase().includes("already been processed"), `Expected already processed error, got: ${body.error}`);
  });

  // Test 11: Self-Approval Block (Partner cannot approve own request)
  await test(11, "Partner attempting to approve own request is blocked", async () => {
    // 1. Partner creates a stage approval request for their own opp
    const ownOppRes = await app.inject({
      method: "POST",
      url: "/api/v1/opportunities",
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: {
        name: "Partner Own Opp",
        accountId,
        amount: 800000,
        pipelineId,
        stageId: demoStageId,
        ownerId: partnerUserId,
      },
    });
    const ownOppId = ownOppRes.json().id;

    const reqRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/opportunities/${ownOppId}`,
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: { stageId: proposalStageId },
    });
    const ownApprovalId = reqRes.json().approval.id;

    // 2. Partner attempts to approve their own request
    const selfApproveRes = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/approvals/${ownApprovalId}/approve`,
      headers: { authorization: `Bearer ${partnerToken}` },
    });

    assert(selfApproveRes.statusCode === 403, `Expected 403 self-approval block, got ${selfApproveRes.statusCode}: ${selfApproveRes.body}`);
    assert(selfApproveRes.json().error.toLowerCase().includes("cannot approve your own"), "Self-approval error message expected");
  });

  // Test 12: Unauthorized Approval (Manager cannot call approve endpoint)
  await test(12, "Manager attempting to approve request is rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/opportunities/approvals/${pendingApprovalId1}/approve`,
      headers: { authorization: `Bearer ${managerToken}` },
    });

    assert(res.statusCode === 403, `Expected 403 forbidden for Manager, got ${res.statusCode}: ${res.body}`);
    assert(res.json().error.toLowerCase().includes("only partners"), "Only Partners message expected");
  });

  // Summary Report
  console.log("\n==================================================================");
  console.log("                  STAGE APPROVAL TEST RESULTS                    ");
  console.log("==================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Passed: ${passedCount} / ${results.length}`);
  if (passedCount === results.length) {
    console.log("SUCCESS: All 12 test scenarios PASSED successfully! 🎉");
  } else {
    console.error("FAILURE: Some tests failed.");
    process.exit(1);
  }

  await app.close();
}

runStageApprovalTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
