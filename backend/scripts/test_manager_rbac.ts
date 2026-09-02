import { PrismaClient } from "@prisma/client";
import { getCreatedByFilter, getVisibleUserIds } from "../src/lib/rbac.js";

const prisma = new PrismaClient();

async function main() {
  const managerA = await prisma.user.findFirstOrThrow({ where: { email: "manager@crm.com" } });
  const managerB = await prisma.user.findFirstOrThrow({ where: { email: "amit.patel@crm.com" } });
  const partner = await prisma.user.findFirstOrThrow({ where: { email: "partner@crm.com" } });
  const seniorPartner = await prisma.user.findFirstOrThrow({ where: { email: "senior.partner@crm.com" } });

  console.log("--- Visible User IDs ---");
  console.log("Manager A visible IDs:", await getVisibleUserIds(managerA as any));
  console.log("Manager B visible IDs:", await getVisibleUserIds(managerB as any));
  console.log("Partner visible IDs:", await getVisibleUserIds(partner as any));

  const filterA = await getCreatedByFilter(managerA as any);
  const filterB = await getCreatedByFilter(managerB as any);
  const filterSP = await getCreatedByFilter(seniorPartner as any);

  const countA = await prisma.account.count({ where: { tenantId: managerA.tenantId, ...filterA, archived: false } });
  const countB = await prisma.account.count({ where: { tenantId: managerB.tenantId, ...filterB, archived: false } });
  const countSP = await prisma.account.count({ where: { tenantId: seniorPartner.tenantId, ...filterSP, archived: false } });

  console.log("--- Account Counts ---");
  console.log(`Manager A sees: ${countA} accounts`);
  console.log(`Manager B sees: ${countB} accounts`);
  console.log(`Senior Partner sees: ${countSP} accounts`);

  if (countA < countSP && countB < countSP) {
    console.log("✅ Manager data isolation verified successfully!");
  } else {
    console.error("❌ RBAC isolation test failed!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
