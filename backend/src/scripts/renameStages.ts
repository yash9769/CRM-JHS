import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Renaming PipelineStages in database from Proposal Won/Lost to Closed Won/Lost...");

  const wonResult = await prisma.pipelineStage.updateMany({
    where: {
      name: {
        in: ["Proposal Won", "proposal won", "Proposal_Won"],
        mode: "insensitive",
      },
    },
    data: {
      name: "Closed Won",
      isClosed: true,
      isWon: true,
      probability: 100,
    },
  });

  const lostResult = await prisma.pipelineStage.updateMany({
    where: {
      name: {
        in: ["Proposal Lost", "proposal lost", "Proposal_Lost"],
        mode: "insensitive",
      },
    },
    data: {
      name: "Closed Lost",
      isClosed: true,
      isWon: false,
      probability: 0,
    },
  });

  console.log(`Updated ${wonResult.count} Won stages to 'Closed Won'`);
  console.log(`Updated ${lostResult.count} Lost stages to 'Closed Lost'`);

  // Also check all pipeline stages
  const allStages = await prisma.pipelineStage.findMany({
    select: { id: true, name: true, order: true, isClosed: true, isWon: true },
    orderBy: { order: "asc" },
  });
  console.log("Current pipeline stages in database:", allStages);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
