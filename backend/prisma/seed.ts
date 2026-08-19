import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  const email = "yashodhan.rajapkar@envistacyberdefence.com";
  const password = "370HSSV0773H@";
  const passwordHash = await argon2.hash(password);

  // 1. Create or Find Tenant
  let tenant = await prisma.tenant.findFirst({
    where: { name: "Envista Cyber Defence" },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "Envista Cyber Defence" },
    });
  }

  // 2. Create or Find User
  let user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        firstName: "Yashodhan",
        lastName: "Rajapkar",
        role: "ADMIN",
        active: true,
      },
    });
  }

  // 3. Create Default Pipelines and Stages if they don't exist
  let oppPipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, type: "OPPORTUNITY" },
    include: { stages: true },
  });

  if (!oppPipeline) {
    oppPipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: "Standard Opportunity Pipeline",
        type: "OPPORTUNITY",
        isDefault: true,
        stages: {
          create: [
            { name: "Lead Qualified", order: 1, probability: 10, isClosed: false, isWon: false },
            { name: "Scope Discussion", order: 2, probability: 25, isClosed: false, isWon: false },
            { name: "Demo", order: 3, probability: 40, isClosed: false, isWon: false },
            { name: "Proposal", order: 4, probability: 60, isClosed: false, isWon: false },
            { name: "Quote", order: 5, probability: 75, isClosed: false, isWon: false },
            { name: "Negotiation", order: 6, probability: 90, isClosed: false, isWon: false },
            { name: "Closed Won", order: 7, probability: 100, isClosed: true, isWon: true },
            { name: "Closed Lost", order: 8, probability: 0, isClosed: true, isWon: false },
          ],
        },
      },
      include: { stages: true },
    });
  }

  let dealPipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, type: "DEAL" },
    include: { stages: true },
  });

  if (!dealPipeline) {
    dealPipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: "Standard Deal Pipeline",
        type: "DEAL",
        isDefault: true,
        stages: {
          create: [
            { name: "Lead Qualified", order: 1, probability: 10, isClosed: false, isWon: false },
            { name: "Scope Discussion", order: 2, probability: 25, isClosed: false, isWon: false },
            { name: "Demo", order: 3, probability: 40, isClosed: false, isWon: false },
            { name: "Proposal", order: 4, probability: 60, isClosed: false, isWon: false },
            { name: "Quote", order: 5, probability: 75, isClosed: false, isWon: false },
            { name: "Negotiation", order: 6, probability: 90, isClosed: false, isWon: false },
            { name: "Closed Won", order: 7, probability: 100, isClosed: true, isWon: true },
            { name: "Closed Lost", order: 8, probability: 0, isClosed: true, isWon: false },
          ],
        },
      },
      include: { stages: true },
    });
  }

  // Helper maps to resolve stage IDs easily
  const oppStages = oppPipeline.stages.reduce((acc: any, s) => {
    acc[s.name] = s.id;
    return acc;
  }, {});

  const dealStages = dealPipeline.stages.reduce((acc: any, s) => {
    acc[s.name] = s.id;
    return acc;
  }, {});

  // 4. Products
  const productsData = [
    { name: "Custom Integration Support", sku: "SRV-INT-002", category: "Services", unitPrice: 5000 },
    { name: "Enterprise Software License", sku: "LIC-ENT-001", category: "Software", unitPrice: 12000 },
    { name: "Premium Admin Training", sku: "SRV-TRN-003", category: "Services", unitPrice: 1500 },
  ];

  const products: any[] = [];
  for (const prod of productsData) {
    let p = await prisma.product.findFirst({
      where: { tenantId: tenant.id, sku: prod.sku },
    });
    if (!p) {
      p = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: prod.name,
          sku: prod.sku,
          category: prod.category,
          unitPrice: prod.unitPrice,
          currency: "INR",
          active: true,
          ownerId: user.id,
        },
      });
    }
    products.push(p);
  }

  // 5. Accounts (Customer companies)
  const accountsData = [
    { name: "Acme Corp", domain: "acme.com", industry: "Manufacturing", employeeCount: 250, annualRevenue: 15000000, accountType: "PROSPECT" as const },
    { name: "Tech Solutions Ltd", domain: "techsolutions.io", industry: "Technology", employeeCount: 45, annualRevenue: 3000000, accountType: "CUSTOMER" as const },
    { name: "Global Industries", domain: "globalind.com", industry: "Logistics", employeeCount: 1200, annualRevenue: 85000000, accountType: "PROSPECT" as const },
  ];

  const accounts: any[] = [];
  for (const acc of accountsData) {
    let a = await prisma.account.findFirst({
      where: { tenantId: tenant.id, name: acc.name },
    });
    if (!a) {
      a = await prisma.account.create({
        data: {
          tenantId: tenant.id,
          name: acc.name,
          domain: acc.domain,
          industry: acc.industry,
          employeeCount: acc.employeeCount,
          annualRevenue: acc.annualRevenue,
          accountType: acc.accountType,
          ownerId: user.id,
        },
      });
    }
    accounts.push(a);
  }

  const acmeAccount = accounts.find(a => a.name === "Acme Corp");
  const techAccount = accounts.find(a => a.name === "Tech Solutions Ltd");
  const globalAccount = accounts.find(a => a.name === "Global Industries");

  // 6. Contacts
  const contactsData = [
    { firstName: "John", lastName: "Doe", email: "john@acme.com", phone: "+1-555-0199", jobTitle: "Purchasing Manager", accountId: acmeAccount.id, lifecycleStage: "LEAD" as const },
    { firstName: "Jane", lastName: "Smith", email: "jane@techsolutions.io", phone: "+1-555-0145", jobTitle: "Chief Technology Officer", accountId: techAccount.id, lifecycleStage: "CUSTOMER" as const },
    { firstName: "Bob", lastName: "Johnson", email: "bob@globalind.com", phone: "+1-555-0182", jobTitle: "Director of IT", accountId: globalAccount.id, lifecycleStage: "LEAD" as const },
  ];

  for (const con of contactsData) {
    const exists = await prisma.contact.findFirst({
      where: { tenantId: tenant.id, email: con.email },
    });
    if (!exists) {
      await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          accountId: con.accountId,
          firstName: con.firstName,
          lastName: con.lastName,
          email: con.email,
          phone: con.phone,
          jobTitle: con.jobTitle,
          lifecycleStage: con.lifecycleStage,
          ownerId: user.id,
        },
      });
    }
  }

  // 7. Opportunities
  const oppsData = [
    { name: "Acme Enterprise License Opportunity", accountId: acmeAccount.id, amount: 25000, stageId: oppStages["Scope Discussion"] || oppStages["Proposal"], probability: 25, type: "NEW_BUSINESS" as const },
    { name: "Global Industries Training Opportunity", accountId: globalAccount.id, amount: 15000, stageId: oppStages["Proposal"] || oppStages["Scope Discussion"], probability: 60, type: "EXPANSION" as const },
  ];

  const opportunities: any[] = [];
  for (const opp of oppsData) {
    let o = await prisma.opportunity.findFirst({
      where: { tenantId: tenant.id, name: opp.name },
    });
    if (!o) {
      o = await prisma.opportunity.create({
        data: {
          tenantId: tenant.id,
          name: opp.name,
          accountId: opp.accountId,
          amount: opp.amount,
          pipelineId: oppPipeline.id,
          stageId: opp.stageId,
          probability: opp.probability,
          ownerId: user.id,
          opportunityType: opp.type,
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      });
    }
    opportunities.push(o);
  }

  // 8. Deals
  const dealsData = [
    { name: "Tech Solutions Setup Deal", accountId: techAccount.id, amount: 50000, stageId: dealStages["Closed Won"], probability: 100, forecastCategory: "CLOSED_WON" as const },
    { name: "Acme Pilot Deal", accountId: acmeAccount.id, amount: 12000, stageId: dealStages["Proposal"], probability: 50, forecastCategory: "PIPELINE" as const },
  ];

  const deals: any[] = [];
  for (const d of dealsData) {
    let dealObj = await prisma.deal.findFirst({
      where: { tenantId: tenant.id, name: d.name },
    });
    if (!dealObj) {
      dealObj = await prisma.deal.create({
        data: {
          tenantId: tenant.id,
          name: d.name,
          accountId: d.accountId,
          amount: d.amount,
          pipelineId: dealPipeline.id,
          stageId: d.stageId,
          probability: d.probability,
          ownerId: user.id,
          forecastCategory: d.forecastCategory,
          closeDate: new Date(),
        },
      });
    }
    deals.push(dealObj);
  }

  const acmeDeal = deals.find(d => d.name === "Acme Pilot Deal");
  const techDeal = deals.find(d => d.name === "Tech Solutions Setup Deal");

  // 9. Quotes
  const quotesData = [
    { quoteNumber: "Q-00001", dealId: acmeDeal.id, accountId: acmeAccount.id, amount: 12000, status: "DRAFT" as const },
    { quoteNumber: "Q-00002", dealId: techDeal.id, accountId: techAccount.id, amount: 50000, status: "ACCEPTED" as const },
  ];

  for (const q of quotesData) {
    const exists = await prisma.quote.findFirst({
      where: { tenantId: tenant.id, quoteNumber: q.quoteNumber },
    });
    if (!exists) {
      await prisma.quote.create({
        data: {
          tenantId: tenant.id,
          quoteNumber: q.quoteNumber,
          dealId: q.dealId,
          accountId: q.accountId,
          amount: q.amount,
          status: q.status,
          ownerId: user.id,
          currency: "INR",
        },
      });
    }
  }

  console.log("Seeding complete! Successfully populated CRM workspace data.");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
