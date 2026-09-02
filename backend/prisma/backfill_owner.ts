import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`UPDATE accounts SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "ownerId" IS NOT NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE contacts SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "ownerId" IS NOT NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE opportunities SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "ownerId" IS NOT NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE leads SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "ownerId" IS NOT NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE activities SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "ownerId" IS NOT NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE quotes SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "ownerId" IS NOT NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE products SET "createdById" = "ownerId" WHERE "createdById" IS NULL AND "ownerId" IS NOT NULL;`);

  console.log("Successfully backfilled all createdById fields to match ownerId!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
