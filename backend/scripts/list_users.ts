import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    include: { tenant: true, partner: true },
  });
  console.log("Registered Users in Database:");
  for (const u of users) {
    console.log(`- Email: ${u.email} | Name: ${u.firstName} ${u.lastName} | OrgRole: ${u.orgRole} | ReportsTo: ${u.partner ? `${u.partner.firstName} ${u.partner.lastName}` : "None"} | Tenant: ${u.tenant?.name}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
