-- Rename "deal"-era columns on opportunities to opportunity-based names.
-- Written by hand as ALTER TABLE ... RENAME COLUMN so existing data is preserved
-- (Prisma's inferred diff would have been DROP COLUMN + ADD COLUMN).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'expectedDealValue'
  ) THEN
    ALTER TABLE "opportunities" RENAME COLUMN "expectedDealValue" TO "expectedOpportunityValue";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'actualDealValue'
  ) THEN
    ALTER TABLE "opportunities" RENAME COLUMN "actualDealValue" TO "actualOpportunityValue";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opportunities' AND column_name = 'dealType'
  ) THEN
    ALTER TABLE "opportunities" RENAME COLUMN "dealType" TO "opportunityTypeLegacy";
  END IF;
END $$;
