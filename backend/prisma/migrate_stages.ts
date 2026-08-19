import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const CANONICAL_STAGES = [
  { name: "Lead Qualified", order: 1, probability: 10, isClosed: false, isWon: false },
  { name: "Scope Discussion", order: 2, probability: 25, isClosed: false, isWon: false },
  { name: "Demo", order: 3, probability: 40, isClosed: false, isWon: false },
  { name: "Proposal", order: 4, probability: 60, isClosed: false, isWon: false },
  { name: "Quote", order: 5, probability: 75, isClosed: false, isWon: false },
  { name: "Negotiation", order: 6, probability: 90, isClosed: false, isWon: false },
  { name: "Closed Won", order: 7, probability: 100, isClosed: true, isWon: true },
  { name: "Closed Lost", order: 8, probability: 0, isClosed: true, isWon: false },
];

const STAGE_NAME_MAP: Record<string, string> = {
  "qualified": "Lead Qualified",
  "lead qualified": "Lead Qualified",
  "discovery": "Scope Discussion",
  "scope discussion": "Scope Discussion",
  "demo / presentation": "Demo",
  "demo": "Demo",
  "proposal / quote": "Proposal",
  "proposal": "Proposal",
  "quote": "Quote",
  "negotiation": "Negotiation",
  "contract review": "Negotiation",
  "legal & security review": "Negotiation",
  "converted to deal": "Closed Won",
  "closed won": "Closed Won",
  "won": "Closed Won",
  "closed lost": "Closed Lost",
  "lost": "Closed Lost",
};

async function migrate() {
  console.log("Starting pipeline stages migration to canonical 8 stages...");

  const pipelines = await prisma.pipeline.findMany({
    include: { stages: true },
  });

  for (const pipeline of pipelines) {
    console.log(`Processing pipeline ${pipeline.name} (${pipeline.id}, type: ${pipeline.type})...`);

    // 1. Ensure all 8 canonical stages exist in this pipeline
    const stageByName = new Map<string, string>(); // canonical name -> stageId

    for (const cStage of CANONICAL_STAGES) {
      const existing = pipeline.stages.find(
        (s) => s.name.toLowerCase().trim() === cStage.name.toLowerCase().trim()
      );
      if (existing) {
        // update order and probability
        const updated = await prisma.pipelineStage.update({
          where: { id: existing.id },
          data: {
            name: cStage.name,
            order: cStage.order,
            probability: cStage.probability,
            isClosed: cStage.isClosed,
            isWon: cStage.isWon,
          },
        });
        stageByName.set(cStage.name, updated.id);
      } else {
        // create canonical stage
        const created = await prisma.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            name: cStage.name,
            order: cStage.order,
            probability: cStage.probability,
            isClosed: cStage.isClosed,
            isWon: cStage.isWon,
          },
        });
        stageByName.set(cStage.name, created.id);
      }
    }

    // 2. Map existing opportunities and deals assigned to old stages
    for (const oldStage of pipeline.stages) {
      const lower = oldStage.name.toLowerCase().trim();
      const targetCanonicalName = STAGE_NAME_MAP[lower] || "Lead Qualified";
      const targetStageId = stageByName.get(targetCanonicalName);

      if (targetStageId && targetStageId !== oldStage.id) {
        // Move opportunities
        await prisma.opportunity.updateMany({
          where: { stageId: oldStage.id },
          data: { stageId: targetStageId },
        });

        // Move deals
        await prisma.deal.updateMany({
          where: { stageId: oldStage.id },
          data: { stageId: targetStageId },
        });

        // Update stage histories
        await prisma.opportunityStageHistory.updateMany({
          where: { toStageId: oldStage.id },
          data: { toStageId: targetStageId },
        });
        await prisma.opportunityStageHistory.updateMany({
          where: { fromStageId: oldStage.id },
          data: { fromStageId: targetStageId },
        });
        await prisma.dealStageHistory.updateMany({
          where: { toStageId: oldStage.id },
          data: { toStageId: targetStageId },
        });
        await prisma.dealStageHistory.updateMany({
          where: { fromStageId: oldStage.id },
          data: { fromStageId: targetStageId },
        });

        // Delete old stage if it is not one of the canonical 8 stages
        const isCanonical = CANONICAL_STAGES.some((c) => c.name.toLowerCase().trim() === lower);
        if (!isCanonical) {
          try {
            await prisma.pipelineStage.delete({ where: { id: oldStage.id } });
            console.log(`Deleted obsolete stage: ${oldStage.name}`);
          } catch (e) {
            console.warn(`Could not delete stage ${oldStage.id}: ${(e as any).message}`);
          }
        }
      }
    }
  }

  // 3. Backfill contactId & dealStageId on opportunities if missing
  console.log("Backfilling opportunity contactId and dealStageId...");
  const opps = await prisma.opportunity.findMany({
    include: { contacts: true, stage: true, pipeline: { include: { tenant: { include: { pipelines: { include: { stages: true } } } } } } },
  });

  for (const opp of opps) {
    const contactId = opp.contactId || opp.contacts[0]?.contactId || null;
    let dealStageId = opp.dealStageId;

    if (!dealStageId) {
      // Find matching deal stage in tenant's deal pipeline
      const dealPipeline = opp.pipeline.tenant.pipelines.find((p) => p.type === "DEAL");
      if (dealPipeline) {
        const matchingStage = dealPipeline.stages.find(
          (s) => s.name.toLowerCase().trim() === opp.stage.name.toLowerCase().trim()
        ) || dealPipeline.stages[0];
        dealStageId = matchingStage?.id || null;
      }
    }

    if (contactId !== opp.contactId || dealStageId !== opp.dealStageId) {
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          contactId: contactId || undefined,
          dealStageId: dealStageId || undefined,
        },
      });
    }
  }

  // 4. Backfill contactId on deals
  console.log("Backfilling deal contactId...");
  const deals = await prisma.deal.findMany({
    include: { contacts: true },
  });

  for (const deal of deals) {
    if (!deal.contactId && deal.contacts[0]?.contactId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { contactId: deal.contacts[0].contactId },
      });
    }
  }

  console.log("Migration completed successfully!");
}

migrate()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
