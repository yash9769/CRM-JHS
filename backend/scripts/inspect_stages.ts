import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const pipelines = await prisma.pipeline.findMany({
    include: {
      stages: { orderBy: { order: "asc" } },
      _count: {
        select: {
          opportunities: true,
          deals: true,
        },
      },
    },
  });
  console.log("PIPELINES:", JSON.stringify(pipelines, null, 2));

  const oppCountByStage = await prisma.opportunity.groupBy({
    by: ["stageId"],
    _count: { id: true },
  });
  console.log("OPP_STAGE_COUNTS:", oppCountByStage);

  const dealCountByStage = await prisma.deal.groupBy({
    by: ["stageId"],
    _count: { id: true },
  });
  console.log("DEAL_STAGE_COUNTS:", dealCountByStage);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
