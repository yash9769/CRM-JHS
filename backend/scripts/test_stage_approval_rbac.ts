import { prisma } from "../src/lib/prisma.js";
import { isApprovalRequiredStage } from "../src/routes/opportunities.js";

async function runRbacTests() {
  console.log("==================================================");
  console.log("RUNNING STAGE APPROVAL RBAC VERIFICATION SUITE");
  console.log("==================================================");

  let passed = 0;
  let total = 15;

  function assert(condition: boolean, testNum: number, title: string, details?: string) {
    if (condition) {
      console.log(`[PASS] Test ${testNum}: ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${testNum}: ${title} - ${details || "Assertion failed"}`);
    }
  }

  // Test 1: Manager Demo -> Proposal
  assert(isApprovalRequiredStage("Proposal", "MANAGER") === false, 1, "Manager Demo -> Proposal: direct change, NO approval");

  // Test 2: Manager Proposal -> Quote
  assert(isApprovalRequiredStage("Quote", "MANAGER") === false, 2, "Manager Proposal -> Quote: direct change, NO approval");

  // Test 3: Manager Quote -> Negotiation
  assert(isApprovalRequiredStage("Negotiation", "MANAGER") === false, 3, "Manager Quote -> Negotiation: direct change, NO approval");

  // Test 4: Manager Negotiation -> Closed Won
  assert(isApprovalRequiredStage("Closed Won", "MANAGER") === true, 4, "Manager Negotiation -> Closed Won requires approval");

  // Test 5: Partner Demo -> Proposal
  assert(isApprovalRequiredStage("Proposal", "PARTNER") === false, 5, "Partner Demo -> Proposal: direct change, NO approval");

  // Test 6: Partner Proposal -> Quote
  assert(isApprovalRequiredStage("Quote", "PARTNER") === false, 6, "Partner Proposal -> Quote: direct change, NO approval");

  // Test 7: Partner Quote -> Negotiation
  assert(isApprovalRequiredStage("Negotiation", "PARTNER") === false, 7, "Partner Quote -> Negotiation: direct change, NO approval");

  // Test 8: Partner Negotiation -> Closed Won
  assert(isApprovalRequiredStage("Closed Won", "PARTNER") === false, 8, "Partner Negotiation -> Closed Won: direct change, NO approval");

  // Test 9: Senior Partner Demo -> Proposal
  assert(isApprovalRequiredStage("Proposal", "SENIOR_PARTNER") === false, 9, "Senior Partner Demo -> Proposal: direct change, NO approval");

  // Test 10: Senior Partner Negotiation -> Closed Won
  assert(isApprovalRequiredStage("Closed Won", "SENIOR_PARTNER") === false, 10, "Senior Partner Negotiation -> Closed Won: direct change, NO approval");

  // Test 11: Manager CSV Import -> Proposal
  assert(isApprovalRequiredStage("Proposal", "MANAGER") === false, 11, "Manager CSV import -> Proposal: direct import, NO approval");

  // Test 12: Partner CSV Import -> Proposal
  assert(isApprovalRequiredStage("Proposal", "PARTNER") === false, 12, "Partner CSV import -> Proposal direct import with NO approval");

  // Test 13: Manager Bulk -> Proposal
  assert(isApprovalRequiredStage("Proposal", "MANAGER") === false, 13, "Manager bulk -> Proposal performs direct update with NO approval");

  // Test 14: Partner Bulk -> Proposal
  assert(isApprovalRequiredStage("Proposal", "PARTNER") === false, 14, "Partner bulk -> Proposal performs direct update with NO approval");

  // Test 15: Senior Partner Bulk -> Proposal
  assert(isApprovalRequiredStage("Proposal", "SENIOR_PARTNER") === false, 15, "Senior Partner bulk -> Proposal performs direct update with NO approval");

  console.log("==================================================");
  console.log(`SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log("==================================================");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRbacTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
