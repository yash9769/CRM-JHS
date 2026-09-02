import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Removing 'Opportunity' stage from all pipelines and reassigning deals...");

  const pipelines = await prisma.pipeline.findMany({
    include: { stages: { orderBy: { order: "asc" } } },
  });

  for (const pipeline of pipelines) {
    const oppStage = pipeline.stages.find((s) => s.name.toLowerCase().trim() === "opportunity");
    if (!oppStage) continue;

    // Find fallback stage in the same pipeline (Scope Discussion or MQL or Lead)
    let fallbackStage = pipeline.stages.find((s) => s.name.toLowerCase().trim() === "scope discussion");
    if (!fallbackStage) {
      fallbackStage = pipeline.stages.find((s) => s.name.toLowerCase().trim() === "marketing qualified lead");
    }
    if (!fallbackStage) {
      fallbackStage = pipeline.stages.find((s) => s.id !== oppStage.id);
    }

    if (fallbackStage) {
      // Reassign opportunities from 'Opportunity' stage to fallback stage
      const updateResult = await prisma.opportunity.updateMany({
        where: { stageId: oppStage.id },
        data: { stageId: fallbackStage.id },
      });
      console.log(`Reassigned ${updateResult.count} deals from 'Opportunity' stage to '${fallbackStage.name}' in pipeline '${pipeline.name}' (${pipeline.id})`);
    }

    // Delete stage approval records referencing oppStage if any
    await prisma.stageApproval.deleteMany({
      where: {
        OR: [{ fromStageId: oppStage.id }, { toStageId: oppStage.id }],
      },
    });

    // Delete the 'Opportunity' stage record
    await prisma.pipelineStage.delete({
      where: { id: oppStage.id },
    });
    console.log(`Deleted 'Opportunity' stage (${oppStage.id}) from pipeline '${pipeline.name}'`);

    // Re-order remaining stages
    const remainingStages = await prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < remainingStages.length; i++) {
      await prisma.pipelineStage.update({
        where: { id: remainingStages[i].id },
        data: { order: i + 1 },
      });
    }
  }

  console.log("Finished removing 'Opportunity' stage from database.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
