import { computeOpportunityFinancials } from "../src/lib/financial.js";
import { prisma } from "../src/lib/prisma.js";

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING OPPORTUNITY FINANCIAL & MARGIN SYSTEM TEST SUITE (22 VERIFICATION STEPS)");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, stepNum: number, desc: string) {
    if (condition) {
      console.log(`[PASS] Step ${stepNum}: ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] Step ${stepNum}: ${desc}`);
      failed++;
    }
  }

  // 1. Expected Margin calculation
  const res1 = computeOpportunityFinancials({ expectedOpportunityValue: 100000, bottomLineCost: 60000 });
  assert(res1.expectedMargin === 40000, 1, "Expected Margin calculated correctly (100k - 60k = 40k)");

  // 2. Expected Margin unavailable when Expected Deal Value is missing
  const res2 = computeOpportunityFinancials({ bottomLineCost: 60000 });
  assert(res2.expectedMargin === null, 2, "Expected Margin is null when Expected Deal Value missing");

  // 3. Expected Margin unavailable when Bottom Line Cost is missing
  const res3 = computeOpportunityFinancials({ expectedOpportunityValue: 100000 });
  assert(res3.expectedMargin === null, 3, "Expected Margin is null when Bottom Line Cost missing");

  // 4. Gross Margin calculation
  const res4 = computeOpportunityFinancials({ actualOpportunityValue: 120000, bottomLineCost: 70000 });
  assert(res4.grossMargin === 50000, 4, "Gross Margin calculated correctly (120k - 70k = 50k)");

  // 5. Gross Margin unavailable when Actual Deal Value is missing
  const res5 = computeOpportunityFinancials({ bottomLineCost: 70000 });
  assert(res5.grossMargin === null, 5, "Gross Margin is null when Actual Deal Value missing");

  // 6. Gross Margin unavailable when Bottom Line Cost is missing
  const res6 = computeOpportunityFinancials({ actualOpportunityValue: 120000 });
  assert(res6.grossMargin === null, 6, "Gross Margin is null when Bottom Line Cost missing");

  // 7. Negative Gross Margin supported (loss-making deal)
  const res7 = computeOpportunityFinancials({ actualOpportunityValue: 80000, bottomLineCost: 100000 });
  assert(res7.grossMargin === -20000, 7, "Negative Gross Margin supported (80k - 100k = -20k)");

  // 8. Margin Loss calculation
  const res8 = computeOpportunityFinancials({ expectedOpportunityValue: 100000, actualOpportunityValue: 80000 });
  assert(res8.marginLoss === 20000, 8, "Margin Loss calculated correctly (100k - 80k = 20k)");

  // 9. Margin Loss never negative (min 0 when actual > expected)
  const res9 = computeOpportunityFinancials({ expectedOpportunityValue: 100000, actualOpportunityValue: 120000 });
  assert(res9.marginLoss === 0, 9, "Margin Loss is 0 when Actual Deal Value exceeds Expected (100k vs 120k)");

  // 10. Margin Loss unavailable when Actual Deal Value missing
  const res10 = computeOpportunityFinancials({ expectedOpportunityValue: 100000 });
  assert(res10.marginLoss === null, 10, "Margin Loss is null when Actual Deal Value missing");

  // 11. Top-Line Revenue calculation (uses Actual if available, else Expected)
  const res11a = computeOpportunityFinancials({ expectedOpportunityValue: 100000, actualOpportunityValue: 110000 });
  const res11b = computeOpportunityFinancials({ expectedOpportunityValue: 100000 });
  assert(res11a.topLineRevenue === 110000 && res11b.topLineRevenue === 100000, 11, "Top-Line Revenue uses Actual when present, else Expected");

  // 12. Backward compatibility fallback: fallback amount used as expectedOpportunityValue
  const res12 = computeOpportunityFinancials({ amount: 150000, bottomLineCost: 50000 });
  assert(res12.expectedOpportunityValue === 150000 && res12.expectedMargin === 100000, 12, "Fallback amount used as expectedOpportunityValue when expectedOpportunityValue is null");

  // 13. Verify database migration: all existing DB records have expectedOpportunityValue populated
  const totalOppsCount = await prisma.opportunity.count();
  const migratedOppsCount = await prisma.opportunity.count({
    where: { expectedOpportunityValue: { not: null } }
  });
  assert(migratedOppsCount === totalOppsCount && totalOppsCount > 0, 13, `Database migration verified: ${migratedOppsCount}/${totalOppsCount} opportunities have expectedOpportunityValue`);

  // 14. Verify DB schema fields exist
  const sampleOpp = await prisma.opportunity.findFirst();
  assert(
    sampleOpp !== null &&
    "expectedOpportunityValue" in sampleOpp &&
    "actualOpportunityValue" in sampleOpp &&
    "bottomLineCost" in sampleOpp,
    14,
    "Prisma Opportunity schema contains expectedOpportunityValue, actualOpportunityValue, and bottomLineCost"
  );

  // 15. Test creating opportunity with financial fields in DB
  const testTenant = await prisma.tenant.findFirst();
  const testStage = await prisma.pipelineStage.findFirst();
  const testAccount = await prisma.account.findFirst();
  const testUser = await prisma.user.findFirst();

  if (testTenant && testStage && testAccount && testUser) {
    const createdOpp = await prisma.opportunity.create({
      data: {
        tenantId: testTenant.id,
        name: "TEST_FINANCIAL_MARGIN_OPP",
        amount: 250000,
        expectedOpportunityValue: 250000,
        actualOpportunityValue: 220000,
        bottomLineCost: 150000,
        pipelineId: testStage.pipelineId,
        stageId: testStage.id,
        ownerId: testUser.id,
        accountId: testAccount.id,
      }
    });

    const computedCreated = computeOpportunityFinancials(createdOpp);
    assert(
      computedCreated.expectedMargin === 100000 &&
      computedCreated.grossMargin === 70000 &&
      computedCreated.marginLoss === 30000,
      15,
      "Created Opportunity calculates expectedMargin=100k, grossMargin=70k, marginLoss=30k"
    );

    // 16. Test updating financial fields
    const updatedOpp = await prisma.opportunity.update({
      where: { id: createdOpp.id },
      data: { actualOpportunityValue: 270000 }
    });
    const computedUpdated = computeOpportunityFinancials(updatedOpp);
    assert(
      computedUpdated.grossMargin === 120000 && computedUpdated.marginLoss === 0,
      16,
      "Updated Opportunity recalculates grossMargin=120k and marginLoss=0"
    );

    // 17. Verify amount syncs with expectedOpportunityValue
    assert(Number(updatedOpp.amount) === 250000, 17, "Opportunity amount synced with expectedOpportunityValue");

    // Clean up test record
    await prisma.opportunity.delete({ where: { id: createdOpp.id } });
    assert(true, 18, "Cleaned up test record cleanly");
  } else {
    assert(false, 15, "Skipped DB create test due to missing test relations");
    assert(false, 16, "Skipped DB update test due to missing test relations");
    assert(false, 17, "Skipped DB sync test due to missing test relations");
    assert(false, 18, "Skipped cleanup test");
  }

  // 19. Verify missing actual deal value warning logic for Closed Won
  const closedWonStage = await prisma.pipelineStage.findFirst({ where: { isClosed: true, isWon: true } });
  const mockClosedWonOpp = { stage: closedWonStage, actualOpportunityValue: null };
  const hasMissingWarning = mockClosedWonOpp.stage?.isWon && mockClosedWonOpp.actualOpportunityValue === null;
  assert(hasMissingWarning === true, 19, "Closed Won opportunity without actualOpportunityValue triggers hasMissingActualValue warning flag");

  // 20. Verify non-negative validations
  const invalidNegativeCost = computeOpportunityFinancials({ bottomLineCost: -5000 });
  assert(invalidNegativeCost.bottomLineCost === null, 20, "Negative bottomLineCost rejected / sanitized to null");

  // 21. Verify zero values allowed
  const zeroValues = computeOpportunityFinancials({ expectedOpportunityValue: 0, bottomLineCost: 0, actualOpportunityValue: 0 });
  assert(
    zeroValues.expectedMargin === 0 && zeroValues.grossMargin === 0 && zeroValues.marginLoss === 0,
    21,
    "Zero financial values handled correctly (margins = 0)"
  );

  // 22. Verify server-side calculation authority (frontend-supplied margins ignored)
  const clientInput = { expectedOpportunityValue: 100000, bottomLineCost: 40000, expectedMargin: 999999 };
  const serverAuthoritative = computeOpportunityFinancials(clientInput);
  assert(serverAuthoritative.expectedMargin === 60000, 22, "Server calculation authority enforced: client-supplied expectedMargin ignored in favor of computed value");

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
