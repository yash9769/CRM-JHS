-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_tenantId_idx" ON "services"("tenantId");
CREATE INDEX "services_tenantId_name_idx" ON "services"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill default service per tenant
INSERT INTO "services" ("id", "tenantId", "name", "description", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'General Services', 'Default service category', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants";

-- AddColumn serviceId to products
ALTER TABLE "products" ADD COLUMN "serviceId" TEXT;

-- Backfill existing products with default service
UPDATE "products" p
SET "serviceId" = s."id"
FROM "services" s
WHERE s."tenantId" = p."tenantId" AND s."name" = 'General Services';

-- Set serviceId NOT NULL
ALTER TABLE "products" ALTER COLUMN "serviceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "products_tenantId_serviceId_idx" ON "products"("tenantId", "serviceId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
