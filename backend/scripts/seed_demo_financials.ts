import { prisma } from "../src/lib/prisma.js";

async function seedFinancials() {
  console.log("Seeding realistic sample financial values for existing opportunities...");

  const opps = await prisma.opportunity.findMany({
    include: { stage: true }
  });

  console.log(`Found ${opps.length} opportunities to update.`);

  let updatedCount = 0;

  for (const opp of opps) {
    const expected = Number(opp.expectedDealValue || opp.amount || 500000);
    // Cost is typically 55% - 75% of expected deal value
    const costRatio = 0.6 + (opp.id.charCodeAt(0) % 15) / 100;
    const bottomLineCost = Math.round(expected * costRatio);

    let actualDealValue: number | null = null;

    if (opp.stage?.isWon) {
      // Closed Won deals have an actual value (sometimes full, sometimes negotiated down by 5-10%)
      const discountRatio = (opp.id.charCodeAt(1) % 10) > 7 ? 0.92 : 1.0;
      actualDealValue = Math.round(expected * discountRatio);
    } else if (opp.stage?.isClosed) {
      // Closed Lost deals might have 0 or null actual value
      actualDealValue = null;
    } else {
      // Open deals that are further along in pipeline (probability >= 50%) might have agreed actual deal value
      if (opp.probability >= 50) {
        actualDealValue = expected;
      } else {
        // Earlier stage open deals have cost set, but actual deal value optional/null until agreed
        actualDealValue = (opp.id.charCodeAt(2) % 2 === 0) ? Math.round(expected * 0.95) : null;
      }
    }

    await prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        expectedDealValue: expected,
        amount: expected,
        actualDealValue,
        bottomLineCost,
      }
    });

    updatedCount++;
  }

  console.log(`Successfully updated ${updatedCount} opportunities with financial value & margin data.`);
  process.exit(0);
}

seedFinancials().catch((err) => {
  console.error("Error seeding financials:", err);
  process.exit(1);
});
