import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Wiping existing CRM database records & starting clean re-seed ===");

  // 0. Purge existing data in reverse dependency order
  await prisma.opportunityAttachment.deleteMany({});
  await prisma.opportunityStageHistory.deleteMany({});
  await prisma.opportunityContact.deleteMany({});
  await prisma.stageApproval.deleteMany({});
  await prisma.accountDeletionRequest.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.lineItem.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.contactEmail.deleteMany({});
  await prisma.contactPhone.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.accountEmail.deleteMany({});
  await prisma.accountPhone.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.sequenceEnrollment.deleteMany({});
  await prisma.sequenceStep.deleteMany({});
  await prisma.sequence.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.pipelineStage.deleteMany({});
  await prisma.pipeline.deleteMany({});
  await prisma.savedView.deleteMany({});
  await prisma.stickyNote.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.forecastTarget.deleteMany({});
  await prisma.association.deleteMany({});
  await prisma.propertyDefinition.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log("Database wiped successfully.");

  const defaultPasswordHash = await argon2.hash("Password123!");
  const seniorPasswordHash = await argon2.hash("370HSSV0773H@");

  // 1. Create Tenant
  const tenant = await prisma.tenant.create({
    data: { name: "Envista Cyber Defence" },
  });

  console.log("Created Tenant:", tenant.name);

  // 2. Create Senior Partners
  const huzeifa = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "huzeifa.unwala@envistacyberdefence.com",
      passwordHash: seniorPasswordHash,
      firstName: "Huzeifa",
      lastName: "Unwala",
      orgRole: "SENIOR_PARTNER",
      active: true,
    },
  });

  const yashodhan = await prisma.user.create({
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

  console.log("Created 2 Senior Partners: Huzeifa Unwala & Yashodhan");

  // 3. Create 6 Partners (4 under Huzeifa, 2 under Yashodhan)
  const partnersData = [
    // Under Huzeifa (4 Partners)
    { firstName: "Rajesh", lastName: "Varma", email: "partner.h1@crm.com", createdById: huzeifa.id, partnerId: huzeifa.id },
    { firstName: "Anita", lastName: "Desai", email: "partner.h2@crm.com", createdById: huzeifa.id, partnerId: huzeifa.id },
    { firstName: "Vikram", lastName: "Malhotra", email: "partner.h3@crm.com", createdById: huzeifa.id, partnerId: huzeifa.id },
    { firstName: "Sneha", lastName: "Gupta", email: "partner.h4@crm.com", createdById: huzeifa.id, partnerId: huzeifa.id },
    // Under Yashodhan (2 Partners)
    { firstName: "Amit", lastName: "Kulkarni", email: "partner.y1@crm.com", createdById: yashodhan.id, partnerId: yashodhan.id },
    { firstName: "Ritu", lastName: "Sharma", email: "partner.y2@crm.com", createdById: yashodhan.id, partnerId: yashodhan.id },
  ];

  const partners: any[] = [];
  for (const p of partnersData) {
    const created = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: p.email,
        passwordHash: defaultPasswordHash,
        firstName: p.firstName,
        lastName: p.lastName,
        orgRole: "PARTNER",
        createdById: p.createdById,
        partnerId: p.partnerId,
        active: true,
      },
    });
    partners.push(created);
  }

  console.log(`Created ${partners.length} Partners (4 under Huzeifa, 2 under Yashodhan).`);

  // 4. Create 12 Managers (2 for each Partner)
  const managerConfigs = [
    { pIndex: 0, firstName: "Priya", lastName: "Sharma", email: "manager.h1a@crm.com" },
    { pIndex: 0, firstName: "Rahul", lastName: "Kapoor", email: "manager.h1b@crm.com" },
    { pIndex: 1, firstName: "Amit", lastName: "Patel", email: "manager.h2a@crm.com" },
    { pIndex: 1, firstName: "Neha", lastName: "Singh", email: "manager.h2b@crm.com" },
    { pIndex: 2, firstName: "Sanjay", lastName: "Rao", email: "manager.h3a@crm.com" },
    { pIndex: 2, firstName: "Kavita", lastName: "Joshi", email: "manager.h3b@crm.com" },
    { pIndex: 3, firstName: "Rohan", lastName: "Mehta", email: "manager.h4a@crm.com" },
    { pIndex: 3, firstName: "Pooja", lastName: "Verma", email: "manager.h4b@crm.com" },
    { pIndex: 4, firstName: "Karan", lastName: "Shah", email: "manager.y1a@crm.com" },
    { pIndex: 4, firstName: "Divya", lastName: "Nair", email: "manager.y1b@crm.com" },
    { pIndex: 5, firstName: "Alok", lastName: "Saxena", email: "manager.y2a@crm.com" },
    { pIndex: 5, firstName: "Swati", lastName: "Agarwal", email: "manager.y2b@crm.com" },
  ];

  const managers: any[] = [];
  for (const m of managerConfigs) {
    const p = partners[m.pIndex];
    const created = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: m.email,
        passwordHash: defaultPasswordHash,
        firstName: m.firstName,
        lastName: m.lastName,
        orgRole: "MANAGER",
        partnerId: p.id,
        createdById: p.id,
        active: true,
      },
    });
    managers.push(created);
  }

  console.log(`Created ${managers.length} Managers (2 per Partner).`);

  // 5. Create Opportunity Pipeline
  const oppPipeline = await prisma.pipeline.create({
    data: {
      tenantId: tenant.id,
      name: "Standard Opportunity Pipeline",
      type: "OPPORTUNITY",
      isDefault: true,
      stages: {
        create: [
          { name: "Prospect", order: 1, probability: 10, isClosed: false, isWon: false },
          { name: "Lead", order: 2, probability: 20, isClosed: false, isWon: false },
          { name: "Scope Discussion", order: 3, probability: 40, isClosed: false, isWon: false },
          { name: "Proposal Sent", order: 4, probability: 60, isClosed: false, isWon: false },
          { name: "Negotiation", order: 5, probability: 80, isClosed: false, isWon: false },
          { name: "Closed Won", order: 6, probability: 100, isClosed: true, isWon: true },
          { name: "Closed Lost", order: 7, probability: 0, isClosed: true, isWon: false },
          { name: "Opportunity Dead", order: 8, probability: 0, isClosed: true, isWon: false },
        ],
      },
    },
    include: { stages: true },
  });

  const stageList = oppPipeline.stages;

  // 6. Services & Products
  const serviceNames = [
    "Cyber Security Consulting",
    "Cloud Infrastructure Audit",
    "Software Licenses & Subscriptions",
    "Managed Security Operations (SOC)",
    "Compliance & Governance",
  ];

  const createdServices: any[] = [];
  for (const sName of serviceNames) {
    const s = await prisma.service.create({
      data: { tenantId: tenant.id, name: sName, description: `${sName} enterprise offerings` },
    });
    createdServices.push(s);
  }

  // 7. Company Prefix List & Domain Extensions
  const companyPrefixes = [
    "Apex", "Nexa", "Zenith", "Quantum", "Cyber", "Stellar", "Vanguard", "Horizon", "Orion", "Alpha",
    "Matrix", "Infinitum", "Pinnacle", "Titan", "Vertex", "Solstice", "Helios", "Aegis", "Velocity", "Synergy",
    "Crest", "Beacon", "Strata", "Paramount", "Equinox", "Cobalt", "Nova", "Trident", "Summit", "Lumina"
  ];
  const companySuffixes = ["Technologies", "Solutions", "Global", "Systems", "Networks", "Capital", "Infotech", "Industries", "Group", "Labs"];
  const industries = ["Financial Services", "Cybersecurity", "Healthcare", "E-Commerce", "Manufacturing", "Logistics", "IT Consulting", "Cloud Infrastructure"];

  const oppTemplates = [
    "Internal Audit",
    "Tax Audit",
    "DPDP Compliance Audit",
    "vAPT Security Assessment",
    "ISO 27001 Certification Audit",
    "SOC 2 Type II Assessment",
    "Cloud Infrastructure Review",
    "Managed SOC Retainer",
    "Red Team Penetration Testing",
    "PCI-DSS Compliance Review",
    "Incident Response Readiness",
    "Threat Intelligence Deployment"
  ];

  let accountCount = 0;
  let opportunityCount = 0;

  // Create 10 Accounts for each of the 12 Managers = 120 Accounts
  // Create 3 Opportunities for each Account = 360 Opportunities
  for (let mIdx = 0; mIdx < managers.length; mIdx++) {
    const manager = managers[mIdx];

    for (let aIdx = 1; aIdx <= 10; aIdx++) {
      accountCount++;
      const pPrefix = companyPrefixes[(accountCount - 1) % companyPrefixes.length];
      const sSuffix = companySuffixes[(accountCount - 1) % companySuffixes.length];
      const accName = `${pPrefix} ${sSuffix} ${accountCount}`;
      const domain = `${pPrefix.toLowerCase()}${sSuffix.toLowerCase()}${accountCount}.com`;
      const industry = industries[(accountCount - 1) % industries.length];

      const account = await prisma.account.create({
        data: {
          tenantId: tenant.id,
          name: accName,
          domain: domain,
          industry: industry,
          accountType: aIdx % 4 === 0 ? "CUSTOMER" : "PROSPECT",
          annualRevenue: 5000000 + (accountCount * 250000),
          employeeCount: 50 + (accountCount * 15),
          ownerId: manager.id,
          createdById: manager.id,
          phone: `+91 98200 ${String(10000 + accountCount).padStart(5, '0')}`,
          website: `https://www.${domain}`,
          description: `Enterprise account in ${industry} managed by ${manager.firstName} ${manager.lastName}.`,
          emails: {
            create: [
              { tenantId: tenant.id, email: `info@${domain}`, isPrimary: true, label: "Work" },
            ]
          },
          phones: {
            create: [
              { tenantId: tenant.id, countryCode: "+91", number: `98200${String(10000 + accountCount).padStart(5, '0')}`, isPrimary: true, label: "Main" }
            ]
          }
        },
      });

      // Create 1 Primary Contact per Account
      const contact = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          accountId: account.id,
          ownerId: manager.id,
          createdById: manager.id,
          firstName: `Contact-${accountCount}`,
          lastName: `Executive`,
          email: `contact${accountCount}@${domain}`,
          phone: `+91 98190 ${String(10000 + accountCount).padStart(5, '0')}`,
          jobTitle: aIdx % 2 === 0 ? "Chief Security Officer" : "VP Information Technology",
        },
      });

      // Create 3 Opportunities per Account = 360 Opportunities total
      for (let oIdx = 1; oIdx <= 3; oIdx++) {
        opportunityCount++;
        const oppTitle = oppTemplates[(opportunityCount - 1) % oppTemplates.length];
        const fullOppName = `${oppTitle} - ${accName}`;

        // Stage distribution: balance across stages
        const stageIndex = (opportunityCount - 1) % stageList.length;
        const stage = stageList[stageIndex];

        const amount = 150000 + (opportunityCount * 25000);
        const expectedVal = Math.round(amount * (stage.probability / 100));

        const isClosedWon = stage.isWon;
        const isClosedLost = stage.name === "Closed Lost" || stage.name === "Opportunity Dead";

        await prisma.opportunity.create({
          data: {
            tenantId: tenant.id,
            accountId: account.id,
            contactId: contact.id,
            ownerId: manager.id,
            createdById: manager.id,
            pipelineId: oppPipeline.id,
            stageId: stage.id,
            name: fullOppName,
            amount: amount,
            expectedOpportunityValue: expectedVal,
            actualOpportunityValue: isClosedWon ? amount : null,
            bottomLineCost: Math.round(amount * 0.65),
            probability: stage.probability,
            forecastCategory: isClosedWon ? "CLOSED_WON" : isClosedLost ? "CLOSED_LOST" : "PIPELINE",
            expectedCloseDate: new Date(Date.now() + (oIdx * 30 * 24 * 60 * 60 * 1000)),
            wonDate: isClosedWon ? new Date() : null,
            lostReason: isClosedLost ? "Budget constraint / Vendor selection" : null,
            description: `${oppTitle} contract for ${accName}. Requirements discussion in progress.`,
          },
        });
      }
    }
  }

  console.log(`Successfully created ${accountCount} Accounts (10 per Manager).`);
  console.log(`Successfully created ${opportunityCount} Opportunities (3 per Account).`);
  console.log("=== Seed Completed Successfully ===");
}

main()
  .catch((e) => {
    console.error("Seed script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
