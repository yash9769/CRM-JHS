-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
