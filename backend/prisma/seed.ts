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
        orgRole: "SENIOR_PARTNER",
        active: true,
      },
    });
  }

  // 3. Create Default Opportunity Pipeline if it doesn't exist
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
            { name: "Prospect", order: 1, probability: 10, isClosed: false, isWon: false },
            { name: "Lead", order: 2, probability: 20, isClosed: false, isWon: false },
            { name: "Marketing Qualified Lead", order: 3, probability: 30, isClosed: false, isWon: false },
            { name: "Opportunity", order: 4, probability: 40, isClosed: false, isWon: false },
            { name: "Scope Discussion", order: 5, probability: 50, isClosed: false, isWon: false },
            { name: "Proposal Sent", order: 6, probability: 65, isClosed: false, isWon: false },
            { name: "Negotiation", order: 7, probability: 80, isClosed: false, isWon: false },
            { name: "Proposal Won", order: 8, probability: 100, isClosed: true, isWon: true },
            { name: "Proposal Lost", order: 9, probability: 0, isClosed: true, isWon: false },
            { name: "Opportunity Dead", order: 10, probability: 0, isClosed: true, isWon: false },
          ],
        },
      },
      include: { stages: true },
    });
  }

  const oppStages = oppPipeline.stages.reduce((acc: any, s) => {
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

  // 5. Accounts
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
    { name: "Acme Enterprise License Opportunity", accountId: acmeAccount.id, amount: 25000, stageId: oppStages["Scope Discussion"] || oppStages["Proposal Sent"], probability: 50, type: "NEW_BUSINESS" as const, forecastCategory: "PIPELINE" as const },
    { name: "Global Industries Training Opportunity", accountId: globalAccount.id, amount: 15000, stageId: oppStages["Proposal Sent"] || oppStages["Scope Discussion"], probability: 65, type: "EXPANSION" as const, forecastCategory: "BEST_CASE" as const },
    { name: "Tech Solutions Setup Opportunity", accountId: techAccount.id, amount: 50000, stageId: oppStages["Proposal Won"], probability: 100, type: "NEW_BUSINESS" as const, forecastCategory: "CLOSED_WON" as const },
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
          forecastCategory: opp.forecastCategory,
          expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          wonDate: opp.forecastCategory === "CLOSED_WON" ? new Date() : null,
        },
      });
    }
    opportunities.push(o);
  }

  const acmeOpp = opportunities.find(o => o.name === "Acme Enterprise License Opportunity");
  const techOpp = opportunities.find(o => o.name === "Tech Solutions Setup Opportunity");

  // 8. Quotes
  const quotesData = [
    { quoteNumber: "Q-00001", opportunityId: acmeOpp.id, accountId: acmeAccount.id, amount: 12000, status: "DRAFT" as const },
    { quoteNumber: "Q-00002", opportunityId: techOpp.id, accountId: techAccount.id, amount: 50000, status: "ACCEPTED" as const },
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
          opportunityId: q.opportunityId,
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
