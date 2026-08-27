import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    include: { tenant: true },
  });
  console.log("Registered Users in Database:");
  for (const u of users) {
    console.log(`- Email: ${u.email} | Name: ${u.firstName} ${u.lastName} | Role: ${u.role} | Tenant: ${u.tenant?.name}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
