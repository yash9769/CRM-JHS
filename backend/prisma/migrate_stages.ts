import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const CANONICAL_OPPORTUNITY_STAGES = [
  { name: "Prospect", order: 1, probability: 10, isClosed: false, isWon: false },
  { name: "Lead", order: 2, probability: 20, isClosed: false, isWon: false },
  { name: "Marketing Qualified Lead", order: 3, probability: 30, isClosed: false, isWon: false },
  { name: "Opportunity", order: 4, probability: 40, isClosed: false, isWon: false },
  { name: "Scope Discussion", order: 5, probability: 50, isClosed: false, isWon: false },
  { name: "Proposal Sent", order: 6, probability: 65, isClosed: false, isWon: false },
  { name: "Negotiation", order: 7, probability: 80, isClosed: false, isWon: false },
  { name: "Closed Won", order: 8, probability: 100, isClosed: true, isWon: true },
  { name: "Closed Lost", order: 9, probability: 0, isClosed: true, isWon: false },
  { name: "Opportunity Dead", order: 10, probability: 0, isClosed: true, isWon: false },
];

const STAGE_NAME_MAP: Record<string, string> = {
  // 1. Prospect
  prospect: "Prospect",
  prospecting: "Prospect",

  // 2. Lead
  lead: "Lead",
  "lead qualified": "Lead",
  qualified: "Lead",

  // 3. Marketing Qualified Lead
  "marketing qualified lead": "Marketing Qualified Lead",
  mql: "Marketing Qualified Lead",

  // 4. Opportunity
  opportunity: "Opportunity",
  demo: "Opportunity",
  "demo / presentation": "Opportunity",
  presentation: "Opportunity",

  // 5. Scope Discussion
  "scope discussion": "Scope Discussion",
  discovery: "Scope Discussion",
  scoping: "Scope Discussion",

  // 6. Proposal Sent
  "proposal sent": "Proposal Sent",
  proposal: "Proposal Sent",
  "proposal / quote": "Proposal Sent",
  quote: "Proposal Sent",

  // 7. Negotiation
  negotiation: "Negotiation",
  "contract review": "Negotiation",
  "legal & security review": "Negotiation",

  // 8. Closed Won
  "proposal won": "Closed Won",
  "closed won": "Closed Won",
  won: "Closed Won",
  "converted to deal": "Closed Won",

  // 9. Closed Lost
  "proposal lost": "Closed Lost",
  "closed lost": "Closed Lost",
  lost: "Closed Lost",

  // 10. Opportunity Dead
  "opportunity dead": "Opportunity Dead",
  dead: "Opportunity Dead",
  closed: "Opportunity Dead",
  cancelled: "Opportunity Dead",
  archived: "Opportunity Dead",
};

async function migrate() {
  console.log("🚀 Starting pipeline stages migration to the new 10 stages...");

  const pipelines = await prisma.pipeline.findMany({
    include: { stages: true, tenant: true },
  });

  for (const pipeline of pipelines) {
    console.log(`\nProcessing pipeline: "${pipeline.name}" (Type: ${pipeline.type}, Tenant: "${pipeline.tenant.name}", ID: ${pipeline.id})`);

    // 1. Ensure all 10 canonical stages exist in this pipeline
    const stageByName = new Map<string, string>(); // canonical stage name -> stage ID

    for (const cStage of CANONICAL_OPPORTUNITY_STAGES) {
      const existing = pipeline.stages.find(
        (s) => s.name.toLowerCase().trim() === cStage.name.toLowerCase().trim()
      );
      if (existing) {
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
        console.log(`  ✓ Updated stage: "${cStage.name}" [order: ${cStage.order}, prob: ${cStage.probability}%, isClosed: ${cStage.isClosed}, isWon: ${cStage.isWon}]`);
      } else {
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
        console.log(`  + Created stage: "${cStage.name}" [order: ${cStage.order}, prob: ${cStage.probability}%, isClosed: ${cStage.isClosed}, isWon: ${cStage.isWon}]`);
      }
    }

    // 2. Map existing opportunities and deals assigned to old stages
    for (const oldStage of pipeline.stages) {
      const lower = oldStage.name.toLowerCase().trim();
      const targetCanonicalName = STAGE_NAME_MAP[lower] || "Lead";
      const targetStageId = stageByName.get(targetCanonicalName);

      if (targetStageId && targetStageId !== oldStage.id) {
        console.log(`  ↻ Remapping records from old stage "${oldStage.name}" -> "${targetCanonicalName}"`);

        // Move opportunities
        const oppUpdate = await prisma.opportunity.updateMany({
          where: { stageId: oldStage.id },
          data: { stageId: targetStageId },
        });
        if (oppUpdate.count > 0) {
          console.log(`    - Moved ${oppUpdate.count} opportunities`);
        }

        // Move opportunities dealStageId if referencing oldStage
        await prisma.opportunity.updateMany({
          where: { dealStageId: oldStage.id },
          data: { dealStageId: targetStageId },
        });

        // Move deals
        const dealUpdate = await prisma.deal.updateMany({
          where: { stageId: oldStage.id },
          data: { stageId: targetStageId },
        });
        if (dealUpdate.count > 0) {
          console.log(`    - Moved ${dealUpdate.count} deals`);
        }

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

        // Delete obsolete stage
        const isCanonical = CANONICAL_OPPORTUNITY_STAGES.some((c) => c.name.toLowerCase().trim() === lower);
        if (!isCanonical) {
          try {
            await prisma.pipelineStage.delete({ where: { id: oldStage.id } });
            console.log(`    - Deleted obsolete stage "${oldStage.name}" (${oldStage.id})`);
          } catch (e) {
            console.warn(`    - Could not delete stage ${oldStage.id}: ${(e as any).message}`);
          }
        }
      }
    }
  }

  console.log("\n✅ Stage migration completed successfully!");
}

migrate()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
