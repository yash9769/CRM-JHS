import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const opps = await prisma.opportunity.findMany({
    include: {
      stage: true,
      account: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Total opportunities in DB: ${opps.length}`);

  const byStage = new Map<string, number>();
  for (const o of opps) {
    const name = o.stage?.name || "No Stage";
    byStage.set(name, (byStage.get(name) || 0) + 1);
  }

  for (const [stage, count] of byStage.entries()) {
    console.log(`Stage "${stage}": ${count} opps`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
