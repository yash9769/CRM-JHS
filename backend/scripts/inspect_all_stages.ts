import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const pipelines = await prisma.pipeline.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      stages: { orderBy: { order: "asc" } },
    },
  });

  for (const p of pipelines) {
    console.log(`Pipeline ${p.name} (type: ${p.type}, tenant: ${p.tenant.name}, id: ${p.id}):`);
    for (const s of p.stages) {
      const oppCount = await prisma.opportunity.count({ where: { stageId: s.id } });
      const dealCount = await prisma.deal.count({ where: { stageId: s.id } });
      console.log(`  [order ${s.order}] ${s.name} (id: ${s.id}, prob: ${s.probability}%, isClosed: ${s.isClosed}, isWon: ${s.isWon}) -> opps: ${oppCount}, deals: ${dealCount}`);
    }
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
