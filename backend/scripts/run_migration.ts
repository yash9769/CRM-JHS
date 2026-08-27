import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('--- STARTING PHASE 2 DATABASE MIGRATION ---');

  // Check if deals table exists
  const dealsTableExistsResult = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'deals'
    );
  `;
  const dealsTableExists = dealsTableExistsResult[0]?.exists;

  if (!dealsTableExists) {
    console.log('`deals` table does not exist or has already been migrated. Skipping migration.');
    return;
  }

  // Row counts before migration
  const dealCountResult = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM "deals"`;
  const convertedDealCountResult = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM "deals" WHERE "opportunity_id" IS NOT NULL`;
  const directDealCountResult = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM "deals" WHERE "opportunity_id" IS NULL`;
  const oppCountBeforeResult = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM "opportunities"`;
  
  const dealCount = Number(dealCountResult[0].count);
  const convertedDealCount = Number(convertedDealCountResult[0].count);
  const directDealCount = Number(directDealCountResult[0].count);
  const oppCountBefore = Number(oppCountBeforeResult[0].count);

  console.log(`Initial State:
  - Total Deals: ${dealCount}
  - Converted Deals (linked to Opportunity): ${convertedDealCount}
  - Direct Deals (unlinked): ${directDealCount}
  - Opportunities count before: ${oppCountBefore}`);

  // Step 1: Add new nullable columns to opportunities
  console.log('\nStep 1: Adding new columns to opportunities...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "opportunities"
      ADD COLUMN IF NOT EXISTS "deal_type" TEXT,
      ADD COLUMN IF NOT EXISTS "forecast_category" "ForecastCategory" NOT NULL DEFAULT 'PIPELINE',
      ADD COLUMN IF NOT EXISTS "actual_close_date" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "won_date" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "lost_reason" TEXT;
  `);
  console.log('Step 1 complete.');

  // Step 2 & 3: Mapping table & backfill/insertion
  console.log('\nStep 2 & 3: Creating deal->opportunity mapping and backfilling/inserting opportunities...');
  await prisma.$executeRawUnsafe(`
    CREATE TEMP TABLE IF NOT EXISTS temp_deal_opp_map (
      deal_id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL
    );
  `);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE temp_deal_opp_map;`);

  // Map converted deals
  await prisma.$executeRawUnsafe(`
    INSERT INTO temp_deal_opp_map (deal_id, opportunity_id)
    SELECT id, opportunity_id FROM "deals" WHERE opportunity_id IS NOT NULL;
  `);

  // Map direct deals (assign opportunity_id = deal_id if no collision, else gen_random_uuid())
  await prisma.$executeRawUnsafe(`
    INSERT INTO temp_deal_opp_map (deal_id, opportunity_id)
    SELECT d.id, 
           CASE WHEN o.id IS NULL THEN d.id ELSE gen_random_uuid()::text END
    FROM "deals" d
    LEFT JOIN "opportunities" o ON d.id = o.id
    WHERE d.opportunity_id IS NULL;
  `);

  // Backfill converted opportunities
  const updatedCount = await prisma.$executeRawUnsafe(`
    UPDATE "opportunities" o
    SET
      "deal_type" = d."deal_type",
      "forecast_category" = d."forecast_category",
      "actual_close_date" = d."close_date",
      "won_date" = d."won_date",
      "lost_reason" = d."lost_reason"
    FROM "deals" d
    WHERE d."opportunity_id" IS NOT NULL AND d."opportunity_id" = o."id";
  `);
  console.log(`Backfilled ${updatedCount} converted opportunities.`);

  // Insert direct deals into opportunities
  const insertedCount = await prisma.$executeRawUnsafe(`
    INSERT INTO "opportunities" (
      "id", "tenant_id", "name", "account_id", "contact_id", "amount",
      "pipeline_id", "stage_id", "probability", "expected_close_date",
      "owner_id", "created_by_id", "opportunity_type", "deal_type",
      "forecast_category", "actual_close_date", "won_date", "lost_reason",
      "description", "properties", "archived", "created_at", "updated_at"
    )
    SELECT
      m.opportunity_id, d."tenant_id", d."name", d."account_id", d."contact_id", d."amount",
      d."pipeline_id", d."stage_id", d."probability", d."close_date",
      d."owner_id", d."created_by_id", 'NEW_BUSINESS'::"OpportunityType", d."deal_type",
      d."forecast_category", d."close_date", d."won_date", d."lost_reason",
      d."description", d."properties", d."archived", d."created_at", d."updated_at"
    FROM "deals" d
    JOIN temp_deal_opp_map m ON d.id = m.deal_id
    WHERE d.opportunity_id IS NULL;
  `);
  console.log(`Inserted ${insertedCount} direct deals into opportunities.`);

  // Step 4: Repoint line_items and quotes
  console.log('\nStep 4: Repointing line_items and quotes...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "line_items" ADD COLUMN IF NOT EXISTS "opportunity_id" TEXT;`);
  const repointedLineItems = await prisma.$executeRawUnsafe(`
    UPDATE "line_items" li
    SET "opportunity_id" = m.opportunity_id
    FROM temp_deal_opp_map m
    WHERE li."deal_id" = m.deal_id AND li."opportunity_id" IS NULL;
  `);
  console.log(`Repointed ${repointedLineItems} line items to opportunity_id.`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "opportunity_id" TEXT;`);
  const repointedQuotes = await prisma.$executeRawUnsafe(`
    UPDATE "quotes" q
    SET "opportunity_id" = m.opportunity_id
    FROM temp_deal_opp_map m
    WHERE q."deal_id" = m.deal_id;
  `);
  console.log(`Repointed ${repointedQuotes} quotes to opportunity_id.`);

  // Step 5: Repoint activities and notes
  console.log('\nStep 5: Repointing activities and notes...');
  const repointedActivities = await prisma.$executeRawUnsafe(`
    UPDATE "activities" a
    SET "opportunity_id" = m.opportunity_id,
        "object_type" = 'OPPORTUNITY'::"AssociatedObjectType"
    FROM temp_deal_opp_map m
    WHERE a."deal_id" = m.deal_id;
  `);
  console.log(`Repointed ${repointedActivities} activities to opportunity_id.`);

  const repointedNotes = await prisma.$executeRawUnsafe(`
    UPDATE "notes" n
    SET "opportunity_id" = m.opportunity_id
    FROM temp_deal_opp_map m
    WHERE n."deal_id" = m.deal_id;
  `);
  console.log(`Repointed ${repointedNotes} notes to opportunity_id.`);

  // Step 6: Pipeline types update
  console.log('\nUpdating Pipelines type DEAL -> OPPORTUNITY...');
  await prisma.$executeRawUnsafe(`UPDATE "pipelines" SET "type" = 'OPPORTUNITY' WHERE "type"::text = 'DEAL';`);

  // Row counts after transformation
  const oppCountAfterResult = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) FROM "opportunities"`;
  const oppCountAfter = Number(oppCountAfterResult[0].count);
  console.log(`\nSanity Check:
  - Opportunities count before: ${oppCountBefore}
  - Direct deals migrated: ${insertedCount}
  - Expected total opportunities: ${oppCountBefore + insertedCount}
  - Actual total opportunities after: ${oppCountAfter}`);

  if (oppCountAfter !== oppCountBefore + insertedCount) {
    throw new Error('Sanity check failed: Opportunity count mismatch!');
  }

  // Step 7: Drop obsolete tables and columns
  console.log('\nStep 7: Dropping obsolete deal tables and deal_id columns...');
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "deal_contacts" CASCADE;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "deal_stage_history" CASCADE;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "deals" CASCADE;`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "line_items" DROP COLUMN IF EXISTS "deal_id";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "quotes" DROP COLUMN IF EXISTS "deal_id";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "deal_id";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "notes" DROP COLUMN IF EXISTS "deal_id";`);
  
  await prisma.$executeRawUnsafe(`ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "converted_deal_id";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "is_converted";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "deal_stage_id";`);

  console.log('--- PHASE 2 DATABASE MIGRATION COMPLETE ---');
}

runMigration()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
