-- Reconciles the migration history with the actual current schema.prisma. This repo's
-- day-to-day schema sync has been `prisma db push` (see CLAUDE.md), not `prisma migrate
-- dev` — so a long run of real schema changes (audit "createdById" columns, the
-- Role -> OrgRole rework, users.partnerId, opportunities.contactId, new money fields on
-- opportunities, and two enum narrowings) were applied directly to dev databases and
-- were never captured as migration files. This migration captures all of that drift in
-- one shot (generated via `prisma migrate diff --from-migrations --to-schema-datamodel`)
-- so that `prisma migrate deploy` against a brand-new database now produces a schema
-- that exactly matches schema.prisma.
--
-- WARNING for anyone with an existing `db push`-managed database that still has a
-- "role" column on users (pre-OrgRole): this migration DROPS that column outright.
-- Applying it as-is against a database with real user role data will lose that data.
-- Such a database should either keep using `db push` (its established workflow), or be
-- migrated by hand (copy role -> orgRole first) before ever running `migrate deploy`
-- against it. Safe to run as-is only against an empty/fresh database.

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('SENIOR_PARTNER', 'PARTNER', 'MANAGER');

-- AlterEnum
BEGIN;
CREATE TYPE "AssociatedObjectType_new" AS ENUM ('ACCOUNT', 'CONTACT', 'OPPORTUNITY', 'QUOTE', 'LEAD');
ALTER TABLE "activities" ALTER COLUMN "objectType" TYPE "AssociatedObjectType_new" USING ("objectType"::text::"AssociatedObjectType_new");
ALTER TYPE "AssociatedObjectType" RENAME TO "AssociatedObjectType_old";
ALTER TYPE "AssociatedObjectType_new" RENAME TO "AssociatedObjectType";
DROP TYPE "AssociatedObjectType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PipelineType_new" AS ENUM ('OPPORTUNITY');
ALTER TABLE "pipelines" ALTER COLUMN "type" TYPE "PipelineType_new" USING ("type"::text::"PipelineType_new");
ALTER TYPE "PipelineType" RENAME TO "PipelineType_old";
ALTER TYPE "PipelineType_new" RENAME TO "PipelineType";
DROP TYPE "PipelineType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "saved_views" DROP CONSTRAINT "saved_views_ownerId_fkey";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "actualOpportunityValue" DECIMAL(16,2),
ADD COLUMN     "bottomLineCost" DECIMAL(16,2),
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "expectedOpportunityValue" DECIMAL(16,2);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "opportunityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "sequences" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sticky_notes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "orgRole" "OrgRole" NOT NULL DEFAULT 'MANAGER',
ADD COLUMN     "partnerId" TEXT;

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE INDEX "accounts_tenantId_createdById_idx" ON "accounts"("tenantId", "createdById");

-- CreateIndex
CREATE INDEX "activities_tenantId_createdById_idx" ON "activities"("tenantId", "createdById");

-- CreateIndex
CREATE INDEX "contacts_tenantId_createdById_idx" ON "contacts"("tenantId", "createdById");

-- CreateIndex
CREATE INDEX "leads_tenantId_createdById_idx" ON "leads"("tenantId", "createdById");

-- CreateIndex
CREATE INDEX "line_items_opportunityId_idx" ON "line_items"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunities_tenantId_contactId_idx" ON "opportunities"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "opportunities_tenantId_createdById_idx" ON "opportunities"("tenantId", "createdById");

-- CreateIndex
CREATE INDEX "products_tenantId_createdById_idx" ON "products"("tenantId", "createdById");

-- CreateIndex
CREATE INDEX "quotes_tenantId_opportunityId_idx" ON "quotes"("tenantId", "opportunityId");

-- CreateIndex
CREATE INDEX "quotes_tenantId_createdById_idx" ON "quotes"("tenantId", "createdById");

-- CreateIndex
CREATE INDEX "sequences_tenantId_createdById_idx" ON "sequences"("tenantId", "createdById");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
