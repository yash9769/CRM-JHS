import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("Running Services migration script...");

  // 1. Create services table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "services" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "services_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "services_tenantId_idx" ON "services"("tenantId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "services_tenantId_name_idx" ON "services"("tenantId", "name");
  `);

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "services" ADD CONSTRAINT "services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    // FK might already exist
  }

  // 2. Create default "General Services" row for each tenant
  await prisma.$executeRawUnsafe(`
    INSERT INTO "services" ("id", "tenantId", "name", "description", "active", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text, "id", 'General Services', 'Default service category', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "tenants"
    WHERE NOT EXISTS (
      SELECT 1 FROM "services" s WHERE s."tenantId" = "tenants"."id" AND s."name" = 'General Services'
    );
  `);

  // 3. Add column serviceId to products if it doesn't exist
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
  `);

  // 4. Backfill existing products
  await prisma.$executeRawUnsafe(`
    UPDATE "products" p
    SET "serviceId" = s."id"
    FROM "services" s
    WHERE s."tenantId" = p."tenantId" AND s."name" = 'General Services' AND p."serviceId" IS NULL;
  `);

  // Fallback for any product whose tenant didn't have General Services
  const firstService = await prisma.$queryRaw<any[]>`SELECT id FROM services LIMIT 1`;
  if (firstService.length > 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE "products" SET "serviceId" = '${firstService[0].id}' WHERE "serviceId" IS NULL;
    `);
  }

  // 5. Make serviceId NOT NULL and add foreign key
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products" ALTER COLUMN "serviceId" SET NOT NULL;
  `);

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "products" ADD CONSTRAINT "products_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
  } catch (e: any) {}

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "products_tenantId_serviceId_idx" ON "products"("tenantId", "serviceId");
  `);

  console.log("Migration executed successfully!");
}

run()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
