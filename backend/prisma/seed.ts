import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding CRM database with 1 year of realistic data...");

  const defaultPasswordHash = await argon2.hash("Password123!");
  const seniorPasswordHash = await argon2.hash("370HSSV0773H@");

  // 1. Create or Find Tenant
  let tenant = await prisma.tenant.findFirst({
    where: { name: "Envista Cyber Defence" },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "Envista Cyber Defence" },
    });
  }

  // 2. Create Users for all 3 Org Roles
  // A) SENIOR PARTNER
  let seniorPartner = await prisma.user.findFirst({
    where: { email: "yashodhan.rajapkar@envistacyberdefence.com" },
  });
  if (!seniorPartner) {
    seniorPartner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "yashodhan.rajapkar@envistacyberdefence.com",
        passwordHash: seniorPasswordHash,
        firstName: "Yashodhan",
        lastName: "Rajapkar",
        orgRole: "SENIOR_PARTNER",
        active: true,
      },
    });
  }

  let sp2 = await prisma.user.findFirst({
    where: { email: "senior.partner@crm.com" },
  });
  if (!sp2) {
    sp2 = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "senior.partner@crm.com",
        passwordHash: defaultPasswordHash,
        firstName: "Vikram",
        lastName: "Mehta",
        orgRole: "SENIOR_PARTNER",
        active: true,
      },
    });
  }

  // B) PARTNER
  let partner = await prisma.user.findFirst({
    where: { email: "partner@crm.com" },
  });
  if (!partner) {
    partner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "partner@crm.com",
        passwordHash: defaultPasswordHash,
        firstName: "Rajesh",
        lastName: "Varma",
        orgRole: "PARTNER",
        active: true,
      },
    });
  }

  // C) MANAGER (Reports to Partner)
  let manager = await prisma.user.findFirst({
    where: { email: "manager@crm.com" },
  });
  if (!manager) {
    manager = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "manager@crm.com",
        passwordHash: defaultPasswordHash,
        firstName: "Priya",
        lastName: "Sharma",
        orgRole: "MANAGER",
        partnerId: partner.id,
        active: true,
      },
    });
  }

  // 3. Create Default Opportunity Pipeline
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

  // 4. Services
  const servicesData = [
    { name: "Cyber Security Consulting", description: "Vulnerability assessments, penetration testing, compliance audits" },
    { name: "Cloud Infrastructure & Migration", description: "AWS/Azure secure cloud deployment and SOC migration" },
    { name: "Software Licenses & Subscriptions", description: "Enterprise EDR, SIEM, and firewalls" },
    { name: "Managed Security Operations (SOC)", description: "24/7 Managed Detection and Response" },
  ];

  const servicesMap: Record<string, any> = {};
  for (const s of servicesData) {
    let service = await prisma.service.findFirst({
      where: { tenantId: tenant.id, name: s.name },
    });
    if (!service) {
      service = await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          description: s.description,
        },
      });
    }
    servicesMap[s.name] = service;
  }

  // 5. Products
  const productsData = [
    { name: "24/7 Managed SOC Retainer", sku: "SOC-RET-001", category: "Services", serviceName: "Managed Security Operations (SOC)", unitPrice: 150000 },
    { name: "Cloud Infrastructure Security Audit", sku: "SEC-AUD-002", category: "Consulting", serviceName: "Cloud Infrastructure & Migration", unitPrice: 250000 },
    { name: "Vulnerability Assessment & Pen Testing", sku: "VAPT-ENT-003", category: "Services", serviceName: "Cyber Security Consulting", unitPrice: 180000 },
    { name: "Enterprise Endpoint EDR License", sku: "EDR-LIC-004", category: "Software", serviceName: "Software Licenses & Subscriptions", unitPrice: 85000 },
    { name: "ISO 27001 Compliance Consulting", sku: "ISO-CMP-005", category: "Consulting", serviceName: "Cyber Security Consulting", unitPrice: 320000 },
  ];

  const productsMap: Record<string, any> = {};
  for (const prod of productsData) {
    let p = await prisma.product.findFirst({
      where: { tenantId: tenant.id, sku: prod.sku },
    });
    if (!p) {
      p = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          serviceId: servicesMap[prod.serviceName].id,
          name: prod.name,
          sku: prod.sku,
          category: prod.category,
          unitPrice: prod.unitPrice,
          currency: "INR",
          active: true,
          ownerId: seniorPartner.id,
        },
      });
    }
    productsMap[prod.sku] = p;
  }

  // 6. Accounts
  const accountsData = [
    { name: "Tata Consultancy Services", domain: "tcs.com", industry: "Technology", employeeCount: 500000, annualRevenue: 1900000000, accountType: "CUSTOMER" as const, ownerId: seniorPartner.id },
    { name: "Infosys Technologies", domain: "infosys.com", industry: "Technology", employeeCount: 300000, annualRevenue: 1500000000, accountType: "CUSTOMER" as const, ownerId: partner.id },
    { name: "Wipro Digital", domain: "wipro.com", industry: "Technology", employeeCount: 220000, annualRevenue: 1100000000, accountType: "CUSTOMER" as const, ownerId: manager.id },
    { name: "Reliance Industries", domain: "ril.com", industry: "Energy & Telecom", employeeCount: 350000, annualRevenue: 9000000000, accountType: "CUSTOMER" as const, ownerId: seniorPartner.id },
    { name: "HDFC Bank", domain: "hdfcbank.com", industry: "Financial Services", employeeCount: 150000, annualRevenue: 2500000000, accountType: "CUSTOMER" as const, ownerId: partner.id },
    { name: "Acme Corp", domain: "acme.com", industry: "Manufacturing", employeeCount: 250, annualRevenue: 15000000, accountType: "PROSPECT" as const, ownerId: manager.id },
    { name: "Tech Solutions Ltd", domain: "techsolutions.io", industry: "Technology", employeeCount: 45, annualRevenue: 3000000, accountType: "CUSTOMER" as const, ownerId: manager.id },
    { name: "Global Industries", domain: "globalind.com", industry: "Logistics", employeeCount: 1200, annualRevenue: 85000000, accountType: "PROSPECT" as const, ownerId: partner.id },
    { name: "ICICI Securities", domain: "icicisecurities.com", industry: "Financial Services", employeeCount: 12000, annualRevenue: 450000000, accountType: "PROSPECT" as const, ownerId: seniorPartner.id },
    { name: "Mahindra Tech", domain: "techmahindra.com", industry: "Technology", employeeCount: 140000, annualRevenue: 600000000, accountType: "CUSTOMER" as const, ownerId: partner.id },
  ];

  const accountsMap: Record<string, any> = {};
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
          ownerId: acc.ownerId,
        },
      });
    }
    accountsMap[acc.name] = a;
  }

  // 7. Contacts
  const contactsData = [
    { firstName: "Rohan", lastName: "Sharma", email: "rohan.sharma@tcs.com", phone: "+91-98765-43210", jobTitle: "VP Information Security", accountName: "Tata Consultancy Services", ownerId: seniorPartner.id },
    { firstName: "Ananya", lastName: "Deshmukh", email: "ananya.d@infosys.com", phone: "+91-99887-76655", jobTitle: "Chief Information Security Officer", accountName: "Infosys Technologies", ownerId: partner.id },
    { firstName: "Vikram", lastName: "Seth", email: "vikram.seth@hdfcbank.com", phone: "+91-91234-56789", jobTitle: "Head of Infrastructure", accountName: "HDFC Bank", ownerId: partner.id },
    { firstName: "Siddharth", lastName: "Nair", email: "sid.nair@wipro.com", phone: "+91-98111-22334", jobTitle: "Director of IT Operations", accountName: "Wipro Digital", ownerId: manager.id },
    { firstName: "Kavita", lastName: "Patel", email: "kavita.p@ril.com", phone: "+91-97222-33445", jobTitle: "Group IT Auditor", accountName: "Reliance Industries", ownerId: seniorPartner.id },
    { firstName: "John", lastName: "Doe", email: "john@acme.com", phone: "+1-555-0199", jobTitle: "Purchasing Manager", accountName: "Acme Corp", ownerId: manager.id },
  ];

  const contactsMap: Record<string, any> = {};
  for (const con of contactsData) {
    let c = await prisma.contact.findFirst({
      where: { tenantId: tenant.id, email: con.email },
    });
    if (!c) {
      c = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          accountId: accountsMap[con.accountName].id,
          firstName: con.firstName,
          lastName: con.lastName,
          email: con.email,
          phone: con.phone,
          jobTitle: con.jobTitle,
          lifecycleStage: "CUSTOMER",
          ownerId: con.ownerId,
        },
      });
    }
    contactsMap[con.email] = c;
  }

  // 8. 1 Year of Opportunities (Dated 2025–2026 across months)
  const now = new Date();
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  const past12MonthsOpps = [
    { name: "TCS Global SOC Migration 2025", accountName: "Tata Consultancy Services", contactEmail: "rohan.sharma@tcs.com", amount: 4500000, stage: "Proposal Won", fc: "CLOSED_WON" as const, monthsAgo: 11, owner: seniorPartner },
    { name: "HDFC Core Banking Security Audit", accountName: "HDFC Bank", contactEmail: "vikram.seth@hdfcbank.com", amount: 2800000, stage: "Proposal Won", fc: "CLOSED_WON" as const, monthsAgo: 9, owner: partner },
    { name: "Reliance Jio ISO 27001 Certification", accountName: "Reliance Industries", contactEmail: "kavita.p@ril.com", amount: 3200000, stage: "Proposal Won", fc: "CLOSED_WON" as const, monthsAgo: 7, owner: seniorPartner },
    { name: "Infosys Cloud Pen Testing Retainer", accountName: "Infosys Technologies", contactEmail: "ananya.d@infosys.com", amount: 1800000, stage: "Proposal Won", fc: "CLOSED_WON" as const, monthsAgo: 5, owner: partner },
    { name: "Wipro EDR Deployment Phase 1", accountName: "Wipro Digital", contactEmail: "sid.nair@wipro.com", amount: 1500000, stage: "Proposal Won", fc: "CLOSED_WON" as const, monthsAgo: 3, owner: manager },
    { name: "ICICI Securities Cloud Compliance 2026", accountName: "ICICI Securities", contactEmail: "vikram.seth@hdfcbank.com", amount: 2200000, stage: "Negotiation", fc: "COMMIT" as const, monthsAgo: 1, owner: seniorPartner },
    { name: "TCS Managed Threat Detection Expansion", accountName: "Tata Consultancy Services", contactEmail: "rohan.sharma@tcs.com", amount: 6000000, stage: "Proposal Sent", fc: "BEST_CASE" as const, monthsAgo: 0, owner: seniorPartner },
    { name: "Acme Corp Firewall Upgrade", accountName: "Acme Corp", contactEmail: "john@acme.com", amount: 850000, stage: "Scope Discussion", fc: "PIPELINE" as const, monthsAgo: 0, owner: manager },
    { name: "Mahindra Tech Penetration Testing", accountName: "Mahindra Tech", contactEmail: "ananya.d@infosys.com", amount: 1200000, stage: "Negotiation", fc: "COMMIT" as const, monthsAgo: 0, owner: partner },
    { name: "Global Industries Legacy SIEM Replacement", accountName: "Global Industries", contactEmail: "john@acme.com", amount: 950000, stage: "Proposal Lost", fc: "CLOSED_LOST" as const, monthsAgo: 4, owner: partner },
  ];

  for (const oppDef of past12MonthsOpps) {
    const createdDate = new Date(now.getTime() - oppDef.monthsAgo * monthMs);
    const closeDate = new Date(createdDate.getTime() + 45 * 24 * 60 * 60 * 1000);
    const wonDate = oppDef.fc === "CLOSED_WON" ? closeDate : null;

    const account = accountsMap[oppDef.accountName];
    const contact = contactsMap[oppDef.contactEmail];

    const exists = await prisma.opportunity.findFirst({
      where: { tenantId: tenant.id, name: oppDef.name },
    });

    if (!exists && account) {
      await prisma.opportunity.create({
        data: {
          tenantId: tenant.id,
          name: oppDef.name,
          accountId: account.id,
          contactId: contact?.id || null,
          amount: oppDef.amount,
          pipelineId: oppPipeline.id,
          stageId: oppStages[oppDef.stage] || oppStages["Scope Discussion"],
          probability: oppDef.fc === "CLOSED_WON" ? 100 : oppDef.fc === "CLOSED_LOST" ? 0 : 75,
          ownerId: oppDef.owner.id,
          opportunityType: "NEW_BUSINESS",
          forecastCategory: oppDef.fc,
          createdAt: createdDate,
          expectedCloseDate: closeDate,
          actualCloseDate: wonDate,
          wonDate: wonDate,
          lostReason: oppDef.fc === "CLOSED_LOST" ? "Competitor price undercutting" : null,
          description: `Strategic security engagement managed by ${oppDef.owner.firstName} ${oppDef.owner.lastName}.`,
        },
      });
    }
  }

  // 9. Activities across the year
  const activitiesData = [
    { type: "MEETING" as const, subject: "Quarterly Cyber Risk Assessment with TCS Leadership", body: "Reviewed 24/7 SOC log telemetry and incident detection response rates.", owner: seniorPartner, account: accountsMap["Tata Consultancy Services"] },
    { type: "CALL" as const, subject: "Proposal discussion call with Infosys CISO", body: "Agreed on scope for cloud vulnerability scanning.", owner: partner, account: accountsMap["Infosys Technologies"] },
    { type: "DEMO" as const, subject: "Live EDR Threat Hunting Demo for HDFC Bank", body: "Demonstrated automated ransomware containment capability.", owner: partner, account: accountsMap["HDFC Bank"] },
    { type: "TASK" as const, subject: "Follow up on ISO 27001 Audit documentation", body: "Send revised compliance checklist to Kavita Patel.", owner: seniorPartner, account: accountsMap["Reliance Industries"] },
    { type: "NOTE" as const, subject: "Initial discovery notes for Acme Corp", body: "Client requested quote for perimeter firewall audit.", owner: manager, account: accountsMap["Acme Corp"] },
  ];

  for (const act of activitiesData) {
    if (act.account) {
      const exists = await prisma.activity.findFirst({
        where: { tenantId: tenant.id, subject: act.subject },
      });
      if (!exists) {
        await prisma.activity.create({
          data: {
            tenantId: tenant.id,
            type: act.type,
            subject: act.subject,
            body: act.body,
            status: "COMPLETED",
            ownerId: act.owner.id,
            objectType: "ACCOUNT",
            accountId: act.account.id,
            createdAt: new Date(now.getTime() - Math.random() * 180 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  console.log("Seeding complete! Successfully populated CRM workspace with 1 year of realistic data.");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
