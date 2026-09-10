-- CreateEnum
-- "stage_approvals" and its enum were part of the Approval Governance feature but were
-- never captured by an earlier migration (the model was only ever schema-synced via
-- `prisma db push`, not through this migration history) — created here, immediately
-- before the ALTER TABLE below that (correctly) assumes it exists.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStatus') THEN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DISAPPROVED', 'CANCELLED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "stage_approvals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT,
    "reviewedById" TEXT,
    "fromStageId" TEXT NOT NULL,
    "toStageId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "requesterComment" TEXT,
    "approverComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "stage_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_approvals_tenantId_opportunityId_idx" ON "stage_approvals"("tenantId", "opportunityId");
CREATE INDEX IF NOT EXISTS "stage_approvals_tenantId_requestedById_idx" ON "stage_approvals"("tenantId", "requestedById");
CREATE INDEX IF NOT EXISTS "stage_approvals_tenantId_approverId_idx" ON "stage_approvals"("tenantId", "approverId");
CREATE INDEX IF NOT EXISTS "stage_approvals_tenantId_reviewedById_idx" ON "stage_approvals"("tenantId", "reviewedById");
CREATE INDEX IF NOT EXISTS "stage_approvals_tenantId_status_idx" ON "stage_approvals"("tenantId", "status");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stage_approvals_tenantId_fkey') THEN
    ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stage_approvals_opportunityId_fkey') THEN
    ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stage_approvals_requestedById_fkey') THEN
    ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stage_approvals_approverId_fkey') THEN
    ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stage_approvals_reviewedById_fkey') THEN
    ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stage_approvals_fromStageId_fkey') THEN
    ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stage_approvals_toStageId_fkey') THEN
    ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "loeValue" TEXT;
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "loeUnit" TEXT DEFAULT 'Hours';
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "poNumber" TEXT;
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "poValue" DECIMAL(16,2);

-- AlterTable
ALTER TABLE "stage_approvals" ADD COLUMN IF NOT EXISTS "loeValue" TEXT;
ALTER TABLE "stage_approvals" ADD COLUMN IF NOT EXISTS "loeUnit" TEXT DEFAULT 'Hours';
ALTER TABLE "stage_approvals" ADD COLUMN IF NOT EXISTS "poNumber" TEXT;
ALTER TABLE "stage_approvals" ADD COLUMN IF NOT EXISTS "poValue" DECIMAL(16,2);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sticky_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "color" TEXT DEFAULT 'yellow',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isMinimized" BOOLEAN NOT NULL DEFAULT false,
    "positionX" INTEGER DEFAULT 0,
    "positionY" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sticky_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "opportunity_attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "stageApprovalId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sticky_notes_tenantId_userId_idx" ON "sticky_notes"("tenantId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunity_attachments_tenantId_opportunityId_idx" ON "opportunity_attachments"("tenantId", "opportunityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "opportunity_attachments_tenantId_stageApprovalId_idx" ON "opportunity_attachments"("tenantId", "stageApprovalId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sticky_notes_tenantId_fkey') THEN
    ALTER TABLE "sticky_notes" ADD CONSTRAINT "sticky_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sticky_notes_userId_fkey') THEN
    ALTER TABLE "sticky_notes" ADD CONSTRAINT "sticky_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_attachments_tenantId_fkey') THEN
    ALTER TABLE "opportunity_attachments" ADD CONSTRAINT "opportunity_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_attachments_opportunityId_fkey') THEN
    ALTER TABLE "opportunity_attachments" ADD CONSTRAINT "opportunity_attachments_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_attachments_stageApprovalId_fkey') THEN
    ALTER TABLE "opportunity_attachments" ADD CONSTRAINT "opportunity_attachments_stageApprovalId_fkey" FOREIGN KEY ("stageApprovalId") REFERENCES "stage_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_attachments_uploadedById_fkey') THEN
    ALTER TABLE "opportunity_attachments" ADD CONSTRAINT "opportunity_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
