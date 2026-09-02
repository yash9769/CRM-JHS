/**
 * seed_rbac.ts
 *
 * Resets crm_dev data and seeds a clean org hierarchy with 1 year of historical data:
 *   Senior Partner: sp@demo.com / Password1!
 *   Partner 1:      p1@demo.com / Password1!
 *   Partner 2:      p2@demo.com / Password1!
 *   Manager 1a:     m1a@demo.com / Password1! (→ Partner 1)
 *   Manager 1b:     m1b@demo.com / Password1! (→ Partner 1)
 *   Manager 2a:     m2a@demo.com / Password1! (→ Partner 2)
 *   Manager 2b:     m2b@demo.com / Password1! (→ Partner 2)
 */

import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();
const PASS = "Password1!";

function getHistoricalDate(monthOffset: number, day: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + monthOffset);
  d.setDate(Math.max(1, Math.min(28, day)));
  d.setHours(10, 0, 0, 0);
  return d;
}

function getPeriodString(monthOffset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthOffset);
  return d.toISOString().slice(0, 7);
}

async function main() {
  console.log("🗑️  Clearing existing data…");

  // Delete in dependency order
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.sequenceEnrollment.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.lineItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.note.deleteMany();
  await prisma.dealStageHistory.deleteMany();
  await prisma.dealContact.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.opportunityStageHistory.deleteMany();
  await prisma.opportunityContact.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.account.deleteMany();
  await prisma.forecastTarget.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.propertyDefinition.deleteMany();
  await prisma.association.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  console.log("✅ Cleared.");

  // ── Tenant
  const tenant = await prisma.tenant.create({ data: { name: "Envista Cyber Defence" } });
  console.log(`🏢 Tenant: ${tenant.name}`);

  const hash = await argon2.hash(PASS);

  // ── Senior Partner
  const sp = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "sp@demo.com",
      passwordHash: hash,
      firstName: "Sarah",
      lastName: "Chen",
      orgRole: "SENIOR_PARTNER",
    },
  });
  console.log(`👑 Senior Partner: ${sp.email}`);

  // ── Partners
  const p1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "p1@demo.com",
      passwordHash: hash,
      firstName: "Priya",
      lastName: "Kapoor",
      orgRole: "PARTNER",
      createdById: sp.id,
    },
  });

  const p2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "p2@demo.com",
      passwordHash: hash,
      firstName: "David",
      lastName: "Reeves",
      orgRole: "PARTNER",
      createdById: sp.id,
    },
  });
  console.log(`🤝 Partners: ${p1.email}, ${p2.email}`);

  // ── Managers under Partner 1
  const m1a = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "m1a@demo.com",
      passwordHash: hash,
      firstName: "Aarav",
      lastName: "Shah",
      orgRole: "MANAGER",
      partnerId: p1.id,
      createdById: p1.id,
    },
  });

  const m1b = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "m1b@demo.com",
      passwordHash: hash,
      firstName: "Nina",
      lastName: "Osei",
      orgRole: "MANAGER",
      partnerId: p1.id,
      createdById: p1.id,
    },
  });

  // ── Managers under Partner 2
  const m2a = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "m2a@demo.com",
      passwordHash: hash,
      firstName: "Jake",
      lastName: "Torres",
      orgRole: "MANAGER",
      partnerId: p2.id,
      createdById: p2.id,
    },
  });

  const m2b = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "m2b@demo.com",
      passwordHash: hash,
      firstName: "Mei",
      lastName: "Lin",
      orgRole: "MANAGER",
      partnerId: p2.id,
      createdById: p2.id,
    },
  });
  console.log(`👔 Managers: ${m1a.email}, ${m1b.email}, ${m2a.email}, ${m2b.email}`);

  // ── Canonical pipelines
  const stages = [
    { name: "Prospect", order: 1, probability: 10, isClosed: false, isWon: false },
    { name: "Lead", order: 2, probability: 20, isClosed: false, isWon: false },
    { name: "Marketing Qualified Lead", order: 3, probability: 30, isClosed: false, isWon: false },
    { name: "Scope Discussion", order: 4, probability: 50, isClosed: false, isWon: false },
    { name: "Proposal Sent", order: 5, probability: 65, isClosed: false, isWon: false },
    { name: "Negotiation", order: 6, probability: 80, isClosed: false, isWon: false },
    { name: "Closed Won", order: 7, probability: 100, isClosed: true, isWon: true },
    { name: "Closed Lost", order: 8, probability: 0, isClosed: true, isWon: false },
    { name: "Opportunity Dead", order: 9, probability: 0, isClosed: true, isWon: false },
  ];

  const oppPipeline = await prisma.pipeline.create({
    data: {
      tenantId: tenant.id,
      name: "Standard Opportunity Pipeline",
      type: "OPPORTUNITY",
      isDefault: true,
      stages: { create: stages },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  const dealPipeline = await prisma.pipeline.create({
    data: {
      tenantId: tenant.id,
      name: "Standard Deal Pipeline",
      type: "DEAL",
      isDefault: true,
      stages: { create: stages },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  const openOppStages = oppPipeline.stages.filter((s) => !s.isClosed);
  const openDealStages = dealPipeline.stages.filter((s) => !s.isClosed);
  const wonStage = dealPipeline.stages.find((s) => s.name === "Closed Won" || s.name === "Proposal Won")!;
  const lostStage = dealPipeline.stages.find((s) => s.name === "Closed Lost" || s.name === "Proposal Lost")!;

  console.log("📋 Pipelines created.");

  // ── Products
  const products = [
    { name: "Premium Cyber Shield", sku: "PCS-01", category: "Software", unitPrice: 12000 },
    { name: "Virtual CISO Advisory", sku: "VCA-02", category: "Services", unitPrice: 25000 },
    { name: "Enterprise EDR Suite", sku: "EDR-03", category: "Software", unitPrice: 5000 },
    { name: "Cloud Security Audit", sku: "CSA-04", category: "Services", unitPrice: 15000 },
  ];
  for (const prod of products) {
    await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: prod.name,
        sku: prod.sku,
        category: prod.category,
        unitPrice: prod.unitPrice,
        currency: "USD",
        active: true,
        ownerId: sp.id,
        createdById: sp.id,
      }
    });
  }
  console.log("📦 Products created.");

  // ── 1 Year Historical Data Generator
  const reps = [p1, p2, m1a, m1b, m2a, m2b];
  const industries = ["Technology", "Finance", "Healthcare", "Manufacturing", "Energy", "Retail", "Education"];
  const titles = [
    "Chief Information Security Officer", "VP of Information Technology", 
    "Head of Cybersecurity", "Director of Infrastructure", 
    "Lead Security Architect", "IT Compliance Manager", "VP of Operations"
  ];
  const accountNames = [
    "Apex", "Summit", "Zenith", "Quantum", "Nexus", "Vanguard", "Horizon", "Velocity", 
    "Catalyst", "Pinnacle", "Aether", "Helix", "Stellar", "Vector", "Titan", "Novus",
    "Synergy", "Ignite", "Fusion", "Equinox", "Orion", "Chronos", "Eclipse", "Solstice"
  ];
  const companySuffixes = ["Group", "Ventures", "Technologies", "Holdings", "Systems", "Global", "Solutions", "Inc"];

  let accountCount = 0;
  let oppCount = 0;

  console.log("🌱 Generating 12 months of historical data with populated pipeline columns...");

  for (let offset = -11; offset <= 0; offset++) {
    const period = getPeriodString(offset);
    console.log(`  📅 Period: ${period}`);

    // Forecast Targets
    for (const rep of reps) {
      await prisma.forecastTarget.create({
        data: {
          tenantId: tenant.id,
          period,
          targetAmount: rep.orgRole === "PARTNER" ? 300000 : 100000,
          ownerId: rep.id,
        }
      });
    }

    // Generate per rep
    for (const rep of reps) {
      const numAccounts = Math.floor(Math.random() * 2) + 1;

      for (let a = 0; a < numAccounts; a++) {
        accountCount++;
        const baseName = accountNames[accountCount % accountNames.length];
        const suffix = companySuffixes[Math.abs(accountCount + offset) % companySuffixes.length];
        const name = `${baseName} ${suffix}`;
        const domain = `${baseName.toLowerCase()}${suffix.toLowerCase().substring(0,3)}.com`;
        const industry = industries[(accountCount + Math.abs(offset)) % industries.length];
        const createdAtDate = getHistoricalDate(offset, 5 + a * 8);

        const account = await prisma.account.create({
          data: {
            tenantId: tenant.id,
            name,
            domain,
            industry,
            ownerId: rep.id,
            createdById: rep.id,
            accountType: offset < -3 ? "CUSTOMER" : "PROSPECT",
            createdAt: createdAtDate,
            updatedAt: createdAtDate,
          }
        });

        // Contact with designation and phone populated
        const jobTitle = titles[(accountCount + a) % titles.length];
        const phone = `+1 (555) ${Math.floor(100 + Math.random() * 899)}-${Math.floor(1000 + Math.random() * 8999)}`;
        const contact = await prisma.contact.create({
          data: {
            tenantId: tenant.id,
            firstName: `LeadContact`,
            lastName: `${baseName}`,
            email: `info@${domain}`,
            jobTitle,
            phone,
            accountId: account.id,
            ownerId: rep.id,
            createdById: rep.id,
            lifecycleStage: offset < -3 ? "CUSTOMER" : "SALES_QUALIFIED",
            createdAt: createdAtDate,
            updatedAt: createdAtDate,
          }
        });

        // Generate Deals for this account
        const dealRandomizer = Math.random();
        let targetStage = wonStage;
        let forecastCategory = "CLOSED_WON" as any;
        let isClosed = true;
        let wonDate: Date | null = getHistoricalDate(offset, 15 + a * 3);
        let closeDate: Date | null = wonDate;

        if (offset === 0) {
          // Current month: mix of Closed Won (50%), Open (35%), Lost (15%)
          if (dealRandomizer < 0.5) {
            targetStage = wonStage;
            forecastCategory = "CLOSED_WON";
            wonDate = getHistoricalDate(0, Math.floor(Math.random() * 15) + 1);
            closeDate = wonDate;
          } else if (dealRandomizer < 0.85) {
            targetStage = openDealStages[(accountCount + a) % openDealStages.length];
            forecastCategory = "PIPELINE";
            isClosed = false;
            wonDate = null;
            closeDate = new Date(Date.now() + Math.random() * 5 * 24 * 60 * 60 * 1000);
          } else {
            targetStage = lostStage;
            forecastCategory = "CLOSED_LOST";
            wonDate = null;
            closeDate = getHistoricalDate(0, 10);
          }
        } else if (offset >= -2) {
          if (dealRandomizer < 0.4) {
            targetStage = openDealStages[(accountCount + a) % openDealStages.length];
            forecastCategory = "PIPELINE";
            isClosed = false;
            wonDate = null;
            closeDate = getHistoricalDate(offset + 1, 10);
          } else if (dealRandomizer < 0.8) {
            targetStage = wonStage;
            forecastCategory = "CLOSED_WON";
          } else {
            targetStage = lostStage;
            forecastCategory = "CLOSED_LOST";
            wonDate = null;
          }
        } else {
          if (dealRandomizer < 0.75) {
            targetStage = wonStage;
            forecastCategory = "CLOSED_WON";
          } else {
            targetStage = lostStage;
            forecastCategory = "CLOSED_LOST";
            wonDate = null;
          }
        }

        const dealAmount = Math.round((Math.random() * 90000 + 15000) / 1000) * 1000;
        const deal = await prisma.deal.create({
          data: {
            tenantId: tenant.id,
            name: `${name} — Cyber Security Suite`,
            accountId: account.id,
            contactId: contact.id,
            amount: dealAmount,
            pipelineId: dealPipeline.id,
            stageId: targetStage.id,
            ownerId: rep.id,
            createdById: rep.id,
            probability: targetStage.probability,
            forecastCategory,
            wonDate,
            closeDate: closeDate || getHistoricalDate(offset + 1, 10),
            createdAt: createdAtDate,
            updatedAt: createdAtDate,
          }
        });

        await prisma.dealStageHistory.create({
          data: {
            dealId: deal.id,
            toStageId: targetStage.id,
            changedById: rep.id,
            changedAt: createdAtDate,
          }
        });

        // ── Opportunities: Populate ALL 10 stages (including Proposal Won, Proposal Lost, Opportunity Dead)
        for (let oppIdx = 0; oppIdx < 3; oppIdx++) {
          oppCount++;
          const targetOppStage = oppPipeline.stages[(oppCount) % oppPipeline.stages.length];
          await prisma.opportunity.create({
            data: {
              tenantId: tenant.id,
              name: `${name} — Opp ${oppCount}`,
              accountId: account.id,
              contactId: contact.id,
              amount: Math.round((Math.random() * 50000 + 10000) / 1000) * 1000,
              pipelineId: oppPipeline.id,
              stageId: targetOppStage.id,
              ownerId: rep.id,
              createdById: rep.id,
              opportunityType: oppIdx === 0 ? "NEW_BUSINESS" : "EXPANSION",
              probability: targetOppStage.probability,
              isConverted: targetOppStage.isWon,
              createdAt: createdAtDate,
              updatedAt: createdAtDate,
            }
          });
        }

        // ── Notes & Activities
        await prisma.activity.create({
          data: {
            tenantId: tenant.id,
            type: "CALL",
            subject: "Discovery Call",
            body: "Completed initial introduction call. Discussed general compliance needs.",
            ownerId: rep.id,
            createdById: rep.id,
            status: "COMPLETED",
            objectType: "DEAL",
            dealId: deal.id,
            accountId: account.id,
            createdAt: createdAtDate,
          }
        });

        if (!isClosed) {
          await prisma.activity.create({
            data: {
              tenantId: tenant.id,
              type: "TASK",
              subject: "Review contract adjustments",
              body: "Schedule follow up to review pricing adjustments.",
              ownerId: rep.id,
              createdById: rep.id,
              dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
              status: "PENDING",
              objectType: "DEAL",
              dealId: deal.id,
              accountId: account.id,
              createdAt: new Date(),
            }
          });
        }

        await prisma.note.create({
          data: {
            tenantId: tenant.id,
            body: `Met with security decision makers. Budget is approved. Key focus is onboarding timeline.`,
            authorId: rep.id,
            dealId: deal.id,
            accountId: account.id,
            createdAt: createdAtDate,
            updatedAt: createdAtDate,
          }
        });

        // Quotes with SENT / VIEWED / DRAFT statuses for "Quotes Awaiting Response"
        const quoteStatuses: ("SENT" | "VIEWED" | "DRAFT" | "ACCEPTED")[] = ["SENT", "VIEWED", "DRAFT", "ACCEPTED"];
        const quoteStatus = quoteStatuses[accountCount % quoteStatuses.length];
        await prisma.quote.create({
          data: {
            tenantId: tenant.id,
            quoteNumber: `Q-${offset + 12}-${accountCount}`,
            dealId: deal.id,
            accountId: account.id,
            amount: deal.amount,
            status: quoteStatus,
            ownerId: rep.id,
            createdById: rep.id,
            expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Expires in 14 days
            createdAt: createdAtDate,
            updatedAt: createdAtDate,
          }
        });
      }

      // Generate Leads with jobTitle and phone
      const numLeads = Math.floor(Math.random() * 2) + 2;
      for (let l = 0; l < numLeads; l++) {
        const leadIdOffset = accountCount + l + offset;
        const leadFName = ["Liam", "Olivia", "Noah", "Emma", "Oliver", "Ava", "Elijah", "Charlotte"][Math.abs(leadIdOffset) % 8];
        const leadLName = ["Jones", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez"][Math.abs(leadIdOffset + 1) % 8];
        const leadCompany = `${accountNames[Math.abs(leadIdOffset) % accountNames.length]} ${companySuffixes[Math.abs(leadIdOffset + 2) % companySuffixes.length]}`;
        const leadCreatedDate = getHistoricalDate(offset, 12 + l * 5);
        const leadTitle = titles[(leadIdOffset) % titles.length];
        const leadPhone = `+1 (555) ${Math.floor(100 + Math.random() * 899)}-${Math.floor(1000 + Math.random() * 8999)}`;

        let leadStatus = "NEW" as any;
        if (offset < -2) {
          leadStatus = Math.random() < 0.5 ? "CONVERTED" : "UNQUALIFIED";
        } else {
          leadStatus = ["NEW", "CONTACTED", "QUALIFIED", "NURTURING"][l % 4] as any;
        }

        await prisma.lead.create({
          data: {
            tenantId: tenant.id,
            firstName: leadFName,
            lastName: leadLName,
            companyName: leadCompany,
            email: `${leadFName.toLowerCase()}.${leadLName.toLowerCase()}@example.com`,
            jobTitle: leadTitle,
            phone: leadPhone,
            status: leadStatus,
            score: Math.floor(Math.random() * 60) + 30,
            ownerId: rep.id,
            createdById: rep.id,
            createdAt: leadCreatedDate,
            updatedAt: leadCreatedDate,
          }
        });
      }
    }
  }

  console.log(`✅ Seed complete! Successfully generated 1 year of historical records.`);
  console.log(`   Total Accounts Created: ${accountCount}`);
  console.log(`   Total Open Opportunities Created across all pipeline columns: ${oppCount}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Credentials:");
  console.log("   Senior Partner: sp@demo.com  / Password1!");
  console.log("   Partner 1:      p1@demo.com  / Password1!");
  console.log("   Partner 2:      p2@demo.com  / Password1!");
  console.log("   Manager 1a:     m1a@demo.com / Password1!");
  console.log("   Manager 1b:     m1b@demo.com / Password1!");
  console.log("   Manager 2a:     m2a@demo.com / Password1!");
  console.log("   Manager 2b:     m2b@demo.com / Password1!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
