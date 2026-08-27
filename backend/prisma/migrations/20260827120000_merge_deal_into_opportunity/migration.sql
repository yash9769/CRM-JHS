-- Phase 2: Database Migration to merge Deal into Opportunity

-- 1. Add new nullable columns to opportunities
ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "dealType" TEXT,
  ADD COLUMN IF NOT EXISTS "forecastCategory" "ForecastCategory" NOT NULL DEFAULT 'PIPELINE',
  ADD COLUMN IF NOT EXISTS "actualCloseDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "wonDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lostReason" TEXT;

-- 2. Repoint line_items and quotes opportunityId
ALTER TABLE "line_items" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;

-- 3. Backfill/Insert data if deals table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    
    -- Create temporary mapping table
    CREATE TEMP TABLE IF NOT EXISTS temp_deal_opp_map (
      deal_id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL
    );
    TRUNCATE TABLE temp_deal_opp_map;

    -- Map converted deals
    INSERT INTO temp_deal_opp_map (deal_id, opportunity_id)
    SELECT id, "opportunityId" FROM "deals" WHERE "opportunityId" IS NOT NULL;

    -- Map direct deals
    INSERT INTO temp_deal_opp_map (deal_id, opportunity_id)
    SELECT d.id, 
           CASE WHEN o.id IS NULL THEN d.id ELSE gen_random_uuid()::text END
    FROM "deals" d
    LEFT JOIN "opportunities" o ON d.id = o.id
    WHERE d."opportunityId" IS NULL;

    -- Backfill converted opportunities
    UPDATE "opportunities" o
    SET
      "dealType" = d."dealType",
      "forecastCategory" = d."forecastCategory",
      "actualCloseDate" = d."closeDate",
      "wonDate" = d."wonDate",
      "lostReason" = d."lostReason"
    FROM "deals" d
    WHERE d."opportunityId" IS NOT NULL AND d."opportunityId" = o.id;

    -- Insert direct deals into opportunities
    INSERT INTO "opportunities" (
      "id", "tenantId", "name", "accountId", "contactId", "amount",
      "pipelineId", "stageId", "probability", "expectedCloseDate",
      "ownerId", "createdById", "opportunityType", "dealType",
      "forecastCategory", "actualCloseDate", "wonDate", "lostReason",
      "description", "properties", "archived", "createdAt", "updatedAt"
    )
    SELECT
      m.opportunity_id, d."tenantId", d."name", d."accountId", d."contactId", d."amount",
      d."pipelineId", d."stageId", d."probability", d."closeDate",
      d."ownerId", d."createdById", 'NEW_BUSINESS'::"OpportunityType", d."dealType",
      d."forecastCategory", d."closeDate", d."wonDate", d."lostReason",
      d."description", d."properties", d."archived", d."createdAt", d."updatedAt"
    FROM "deals" d
    JOIN temp_deal_opp_map m ON d.id = m.deal_id
    WHERE d."opportunityId" IS NULL;

    -- Repoint line items
    UPDATE "line_items" li
    SET "opportunityId" = m.opportunity_id
    FROM temp_deal_opp_map m
    WHERE li."dealId" = m.deal_id AND li."opportunityId" IS NULL;

    -- Repoint quotes
    UPDATE "quotes" q
    SET "opportunityId" = m.opportunity_id
    FROM temp_deal_opp_map m
    WHERE q."dealId" = m.deal_id;

    -- Repoint activities
    UPDATE "activities" a
    SET "opportunityId" = m.opportunity_id,
        "objectType" = 'OPPORTUNITY'::"AssociatedObjectType"
    FROM temp_deal_opp_map m
    WHERE a."dealId" = m.deal_id;

    -- Repoint notes
    UPDATE "notes" n
    SET "opportunityId" = m.opportunity_id
    FROM temp_deal_opp_map m
    WHERE n."dealId" = m.deal_id;

    -- Drop old tables & columns
    DROP TABLE IF EXISTS "deal_contacts" CASCADE;
    DROP TABLE IF EXISTS "deal_stage_history" CASCADE;
    DROP TABLE IF EXISTS "deals" CASCADE;

    ALTER TABLE "line_items" DROP COLUMN IF EXISTS "dealId";
    ALTER TABLE "quotes" DROP COLUMN IF EXISTS "dealId";
    ALTER TABLE "activities" DROP COLUMN IF EXISTS "dealId";
    ALTER TABLE "notes" DROP COLUMN IF EXISTS "dealId";

    ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "convertedDealId";
    ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "isConverted";
    ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "dealStageId";

  END IF;
END $$;
