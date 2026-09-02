import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Populating workspace for d@gmail.com...");

  const email = "d@gmail.com";
  const password = "Password123!";
  const passwordHash = await argon2.hash(password);

  let user = await prisma.user.findFirst({
    where: { email },
    include: { tenant: true },
  });

  let tenant = user?.tenant;
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "Delta Enterprise CRM" },
    });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        firstName: "David",
        lastName: "Miller",
        role: "ADMIN",
        active: true,
      },
      include: { tenant: true },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        active: true,
        role: "ADMIN",
      },
      include: { tenant: true },
    });
  }

  // 1. Team Members
  const teamMembers = [
    { email: `alex.${tenant.id.slice(0, 4)}@delta.com`, firstName: "Alex", lastName: "Morgan", role: "SALES_MANAGER" as const },
    { email: `sarah.${tenant.id.slice(0, 4)}@delta.com`, firstName: "Sarah", lastName: "Jenkins", role: "SALES_REP" as const },
    { email: `mike.${tenant.id.slice(0, 4)}@delta.com`, firstName: "Mike", lastName: "Ross", role: "SALES_REP" as const },
  ];

  const createdTeam: Record<string, string> = { [user.email]: user.id };
  for (const tm of teamMembers) {
    let u = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: tm.email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: tm.email,
          passwordHash,
          firstName: tm.firstName,
          lastName: tm.lastName,
          role: tm.role,
          active: true,
        },
      });
    }
    createdTeam[tm.email] = u.id;
  }

  // 2. Pipelines & Stages
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
            { name: "Closed Won", order: 8, probability: 100, isClosed: true, isWon: true },
            { name: "Closed Lost", order: 9, probability: 0, isClosed: true, isWon: false },
            { name: "Opportunity Dead", order: 10, probability: 0, isClosed: true, isWon: false },
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
            { name: "Prospect", order: 1, probability: 10, isClosed: false, isWon: false },
            { name: "Lead", order: 2, probability: 20, isClosed: false, isWon: false },
            { name: "Marketing Qualified Lead", order: 3, probability: 30, isClosed: false, isWon: false },
            { name: "Opportunity", order: 4, probability: 40, isClosed: false, isWon: false },
            { name: "Scope Discussion", order: 5, probability: 50, isClosed: false, isWon: false },
            { name: "Proposal Sent", order: 6, probability: 65, isClosed: false, isWon: false },
            { name: "Negotiation", order: 7, probability: 80, isClosed: false, isWon: false },
            { name: "Closed Won", order: 8, probability: 100, isClosed: true, isWon: true },
            { name: "Closed Lost", order: 9, probability: 0, isClosed: true, isWon: false },
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

  const dealStages = dealPipeline.stages.reduce((acc: any, s) => {
    acc[s.name] = s.id;
    return acc;
  }, {});

  const getOppStage = (name: string) => oppStages[name] || oppStages["Scope Discussion"] || oppStages["Proposal"] || oppStages["Negotiation"] || oppPipeline.stages[0]?.id;
  const getDealStage = (name: string) => dealStages[name] || dealStages["Proposal"] || dealStages["Negotiation"] || dealPipeline.stages[0]?.id;

  // 3. Products
  const productsData = [
    { name: "Enterprise Security Audit", sku: `SEC-AUD-${tenant.id.slice(0, 4)}`, category: "Consulting", unitPrice: 150000, description: "Comprehensive ISO27001 & SOC2 gap assessment." },
    { name: "Cloud Infrastructure Pentest", sku: `SEC-PEN-${tenant.id.slice(0, 4)}`, category: "Security Services", unitPrice: 85000, description: "AWS & Azure vulnerability testing." },
    { name: "Managed SOC Subscription (Annual)", sku: `SOC-SUB-${tenant.id.slice(0, 4)}`, category: "Managed Services", unitPrice: 500000, description: "24/7 SIEM monitoring and incident escalation." },
    { name: "Incident Response Retainer", sku: `IR-RET-${tenant.id.slice(0, 4)}`, category: "Retainer", unitPrice: 120000, description: "Guaranteed 1-hour SLA response for critical incidents." },
    { name: "Security Awareness Employee Training", sku: `TRN-SEC-${tenant.id.slice(0, 4)}`, category: "Training", unitPrice: 45000, description: "Phishing simulation and training platform." },
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
          description: prod.description,
          currency: "INR",
          active: true,
          ownerId: user.id,
        },
      });
    }
    products.push(p);
  }

  // 4. Accounts
  const accountsData = [
    { name: "HDFC Cyber Tech Ltd", domain: "hdfccyber.com", industry: "Financial Services", employeeCount: 1400, annualRevenue: 450000000, accountType: "CUSTOMER" as const, phone: "+91-22-66001122", website: "https://hdfccyber.com", ownerId: user.id },
    { name: "Reliance Digital Solutions", domain: "reliancedigital.in", industry: "Telecommunications", employeeCount: 5200, annualRevenue: 1200000000, accountType: "CUSTOMER" as const, phone: "+91-22-30004000", website: "https://reliancedigital.in", ownerId: user.id },
    { name: "Tata Cloud Systems", domain: "tatacloud.com", industry: "IT Services", employeeCount: 850, annualRevenue: 280000000, accountType: "PROSPECT" as const, phone: "+91-22-22881000", website: "https://tatacloud.com", ownerId: user.id },
    { name: "Infosys Security Labs", domain: "infosyssec.com", industry: "Software", employeeCount: 380, annualRevenue: 150000000, accountType: "PROSPECT" as const, phone: "+91-80-41102000", website: "https://infosyssec.com", ownerId: user.id },
    { name: "Wipro Global Innovations", domain: "wiproinnovations.com", industry: "Consulting", employeeCount: 220, annualRevenue: 95000000, accountType: "FORMER_CUSTOMER" as const, phone: "+91-80-28440011", website: "https://wiproinnovations.com", ownerId: user.id },
    { name: "Apex Logistics India", domain: "apexlogistics.in", industry: "Logistics", employeeCount: 95, annualRevenue: 35000000, accountType: "PROSPECT" as const, phone: "+91-11-45009900", website: "https://apexlogistics.in", ownerId: user.id },
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
          phone: acc.phone,
          website: acc.website,
          ownerId: acc.ownerId,
        },
      });
    }
    accounts.push(a);
  }

  const hdfcAcc = accounts.find(a => a.name.includes("HDFC"));
  const relianceAcc = accounts.find(a => a.name.includes("Reliance"));
  const tataAcc = accounts.find(a => a.name.includes("Tata"));
  const infosysAcc = accounts.find(a => a.name.includes("Infosys"));
  const wiproAcc = accounts.find(a => a.name.includes("Wipro"));
  const apexAcc = accounts.find(a => a.name.includes("Apex"));

  // 5. Contacts
  const contactsData = [
    { firstName: "Rahul", lastName: "Sharma", email: `rahul.${tenant.id.slice(0, 4)}@hdfccyber.com`, phone: "+91-9820011223", jobTitle: "Chief Technology Officer", accountId: hdfcAcc.id, lifecycleStage: "CUSTOMER" as const, ownerId: user.id },
    { firstName: "Priya", lastName: "Nair", email: `priya.${tenant.id.slice(0, 4)}@reliancedigital.in`, phone: "+91-9833344556", jobTitle: "Head of InfoSec", accountId: relianceAcc.id, lifecycleStage: "CUSTOMER" as const, ownerId: user.id },
    { firstName: "Amit", lastName: "Patel", email: `amit.${tenant.id.slice(0, 4)}@tatacloud.com`, phone: "+91-9870099887", jobTitle: "VP Infrastructure", accountId: tataAcc.id, lifecycleStage: "OPPORTUNITY" as const, ownerId: user.id },
    { firstName: "Sneha", lastName: "Kulkarni", email: `sneha.${tenant.id.slice(0, 4)}@infosyssec.com`, phone: "+91-9811122334", jobTitle: "CISO", accountId: infosysAcc.id, lifecycleStage: "SALES_QUALIFIED" as const, ownerId: user.id },
    { firstName: "Vikram", lastName: "Malhotra", email: `vikram.${tenant.id.slice(0, 4)}@wiproinnovations.com`, phone: "+91-9844455667", jobTitle: "IT Operations Director", accountId: wiproAcc.id, lifecycleStage: "MARKETING_QUALIFIED" as const, ownerId: user.id },
    { firstName: "Ananya", lastName: "Roy", email: `ananya.${tenant.id.slice(0, 4)}@apexlogistics.in`, phone: "+91-9855566778", jobTitle: "Security Architect", accountId: apexAcc.id, lifecycleStage: "LEAD" as const, ownerId: user.id },
  ];

  const contacts: any[] = [];
  for (const con of contactsData) {
    let c = await prisma.contact.findFirst({
      where: { tenantId: tenant.id, email: con.email },
    });
    if (!c) {
      c = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          accountId: con.accountId,
          firstName: con.firstName,
          lastName: con.lastName,
          email: con.email,
          phone: con.phone,
          jobTitle: con.jobTitle,
          lifecycleStage: con.lifecycleStage,
          ownerId: con.ownerId,
        },
      });
    }
    contacts.push(c);
  }

  // 6. Leads
  const leadsData = [
    { firstName: "Rajesh", lastName: "Gupta", email: `rajesh.${tenant.id.slice(0, 4)}@zomatotech.com`, companyName: "Zomato Technologies", jobTitle: "VP Engineering", phone: "+91-9899911122", source: "Website Form", status: "QUALIFIED" as const, score: 85, notes: "Requested SOC2 compliance demo urgently.", ownerId: user.id },
    { firstName: "Kavita", lastName: "Verma", email: `kavita.${tenant.id.slice(0, 4)}@swiggylabs.com`, companyName: "Swiggy Labs", jobTitle: "Head of DevOps", phone: "+91-9899922233", source: "Webinar", status: "NEW" as const, score: 60, notes: "Attended Cloud Pentest webinar.", ownerId: user.id },
    { firstName: "Deepak", lastName: "Joshi", email: `deepak.${tenant.id.slice(0, 4)}@flipkartsec.com`, companyName: "Flipkart Security", jobTitle: "Principal Architect", phone: "+91-9899933344", source: "Cold Call", status: "CONTACTED" as const, score: 75, notes: "Interested in annual IR retainer.", ownerId: user.id },
    { firstName: "Meera", lastName: "Deshmukh", email: `meera.${tenant.id.slice(0, 4)}@paytmpayments.com`, companyName: "Paytm Payments", jobTitle: "IT Audit Manager", phone: "+91-9899944455", source: "LinkedIn", status: "NURTURING" as const, score: 40, notes: "Following up next quarter after budget approval.", ownerId: user.id },
    { firstName: "Rohan", lastName: "Mehta", email: `rohan.${tenant.id.slice(0, 4)}@neobank.io`, companyName: "NeoBank Tech", jobTitle: "Founder & CEO", phone: "+91-9899955566", source: "Referral", status: "CONVERTED" as const, score: 95, notes: "Converted into HDFC Cyber account pipeline.", ownerId: user.id },
  ];

  for (const ld of leadsData) {
    const exists = await prisma.lead.findFirst({
      where: { tenantId: tenant.id, email: ld.email },
    });
    if (!exists) {
      await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          firstName: ld.firstName,
          lastName: ld.lastName,
          email: ld.email,
          companyName: ld.companyName,
          jobTitle: ld.jobTitle,
          phone: ld.phone,
          source: ld.source,
          status: ld.status,
          score: ld.score,
          notes: ld.notes,
          ownerId: ld.ownerId,
        },
      });
    }
  }

  // 7. Opportunities
  const oppsData = [
    { name: "HDFC Enterprise SOC Migration", accountId: hdfcAcc.id, amount: 4500000, stageId: getOppStage("Proposal / Quote"), probability: 60, type: "EXPANSION" as const, ownerId: user.id },
    { name: "Reliance Multi-Cloud Pentest Project", accountId: relianceAcc.id, amount: 1200000, stageId: getOppStage("Negotiation"), probability: 80, type: "NEW_BUSINESS" as const, ownerId: user.id },
    { name: "Tata Cloud ISO27001 Security Audit", accountId: tataAcc.id, amount: 850000, stageId: getOppStage("Demo / Presentation"), probability: 40, type: "NEW_BUSINESS" as const, ownerId: user.id },
    { name: "Infosys Annual SOC Monitoring", accountId: infosysAcc.id, amount: 2400000, stageId: getOppStage("Discovery"), probability: 25, type: "NEW_BUSINESS" as const, ownerId: user.id },
    { name: "Apex Logistics Perimeter Defense", accountId: apexAcc.id, amount: 350000, stageId: getOppStage("Qualified"), probability: 10, type: "NEW_BUSINESS" as const, ownerId: user.id },
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
          ownerId: opp.ownerId,
          opportunityType: opp.type,
          expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        },
      });
    }
    opportunities.push(o);
  }

  // 8. Deals
  const dealsData = [
    { name: "Reliance Annual Managed SOC Contract", accountId: relianceAcc.id, amount: 5000000, stageId: getDealStage("Closed Won"), probability: 100, forecastCategory: "CLOSED_WON" as const, wonDate: new Date(), ownerId: user.id },
    { name: "HDFC SIEM & Threat Intelligence Deal", accountId: hdfcAcc.id, amount: 1800000, stageId: getDealStage("Contract Review") || getDealStage("Negotiation"), probability: 90, forecastCategory: "COMMIT" as const, ownerId: user.id },
    { name: "Tata Cloud Security Architecture Retainer", accountId: tataAcc.id, amount: 950000, stageId: getDealStage("Negotiation") || getDealStage("Proposal"), probability: 70, forecastCategory: "BEST_CASE" as const, ownerId: user.id },
    { name: "Wipro Employee Security Awareness Deal", accountId: wiproAcc.id, amount: 450000, stageId: getDealStage("Proposal"), probability: 50, forecastCategory: "PIPELINE" as const, ownerId: user.id },
    { name: "Legacy Server Vulnerability Fix Deal", accountId: wiproAcc.id, amount: 600000, stageId: getDealStage("Closed Lost"), probability: 0, forecastCategory: "CLOSED_LOST" as const, lostReason: "Client chose internal team", ownerId: user.id },
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
          ownerId: d.ownerId,
          forecastCategory: d.forecastCategory,
          wonDate: d.wonDate,
          lostReason: d.lostReason,
          closeDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        },
      });
    }
    deals.push(dealObj);
  }

  const relianceDeal = deals.find(d => d.name.includes("Reliance"));
  const hdfcDeal = deals.find(d => d.name.includes("HDFC"));
  const tataDeal = deals.find(d => d.name.includes("Tata"));

  // 9. Line Items
  const socProduct = products.find(p => p.sku.startsWith("SOC-SUB"));
  const auditProduct = products.find(p => p.sku.startsWith("SEC-AUD"));

  if (relianceDeal && socProduct) {
    const exists = await prisma.lineItem.findFirst({ where: { dealId: relianceDeal.id } });
    if (!exists) {
      await prisma.lineItem.create({
        data: {
          productId: socProduct.id,
          dealId: relianceDeal.id,
          quantity: 1,
          unitPrice: 5000000,
          discountPct: 0,
          taxPct: 18,
          total: 5900000,
        },
      });
    }
  }

  if (hdfcDeal && auditProduct) {
    const exists = await prisma.lineItem.findFirst({ where: { dealId: hdfcDeal.id } });
    if (!exists) {
      await prisma.lineItem.create({
        data: {
          productId: auditProduct.id,
          dealId: hdfcDeal.id,
          quantity: 12,
          unitPrice: 150000,
          discountPct: 10,
          taxPct: 18,
          total: 1911600,
        },
      });
    }
  }

  // 10. Quotes
  const quotesData = [
    { quoteNumber: `Q-${tenant.id.slice(0, 4)}-001`, dealId: relianceDeal.id, accountId: relianceAcc.id, amount: 5000000, status: "ACCEPTED" as const, ownerId: user.id },
    { quoteNumber: `Q-${tenant.id.slice(0, 4)}-002`, dealId: hdfcDeal.id, accountId: hdfcAcc.id, amount: 1800000, status: "SENT" as const, ownerId: user.id },
    { quoteNumber: `Q-${tenant.id.slice(0, 4)}-003`, dealId: tataDeal.id, accountId: tataAcc.id, amount: 950000, status: "DRAFT" as const, ownerId: user.id },
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
          ownerId: q.ownerId,
          currency: "INR",
          expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // 11. Sequences
  let seq1 = await prisma.sequence.findFirst({
    where: { tenantId: tenant.id, name: "Enterprise CISO Cold Outreach" },
  });

  if (!seq1) {
    seq1 = await prisma.sequence.create({
      data: {
        tenantId: tenant.id,
        name: "Enterprise CISO Cold Outreach",
        description: "Multi-step automated email & call sequence targeting CISOs.",
        status: "ACTIVE",
        ownerId: user.id,
        steps: {
          create: [
            { order: 1, type: "EMAIL", config: { subject: "ISO27001 Compliance Audit for {{company}}", body: "Hi {{firstName}}, would love to share our security framework..." } },
            { order: 2, type: "WAIT", config: { delayDays: 3 } },
            { order: 3, type: "CALL_REMINDER", config: { note: "Follow up call on proposal" } },
            { order: 4, type: "EMAIL", config: { subject: "Case Study: Endpoint Security", body: "Hi {{firstName}}, sharing a quick case study..." } },
          ],
        },
      },
    });

    const snehaCon = contacts.find(c => c.email.includes("sneha"));
    if (snehaCon) {
      await prisma.sequenceEnrollment.create({
        data: {
          sequenceId: seq1.id,
          contactId: snehaCon.id,
          status: "ACTIVE",
          currentStepIdx: 1,
        },
      });
    }
  }

  // 12. Activities & Tasks
  const today = new Date();
  const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const activitiesData = [
    { type: "CALL" as const, subject: "Discovery Call with Rahul Sharma (HDFC CTO)", body: "Reviewed SIEM integration timelines. Requested SOC2 report.", status: "COMPLETED" as const, objectType: "ACCOUNT" as const, accountId: hdfcAcc.id, ownerId: user.id, completedDate: new Date() },
    { type: "MEETING" as const, subject: "Security Architecture Presentation to Priya Nair", body: "Presented Managed SOC pricing and escalation matrix.", status: "COMPLETED" as const, objectType: "DEAL" as const, dealId: relianceDeal.id, ownerId: user.id, completedDate: new Date() },
    { type: "TASK" as const, subject: "Prepare Custom Security Audit Proposal for Tata Cloud", body: "Include 10% volume discount for annual retainer.", status: "PENDING" as const, objectType: "OPPORTUNITY" as const, accountId: tataAcc.id, ownerId: user.id, dueDate: today },
    { type: "EMAIL" as const, subject: "Send Executed Quote to HDFC Legal", body: "Attached final PDF quote with revised payment terms.", status: "COMPLETED" as const, objectType: "QUOTE" as const, accountId: hdfcAcc.id, ownerId: user.id, completedDate: new Date() },
    { type: "FOLLOW_UP" as const, subject: "Check SLA Clause 4.2 Status with Reliance Legal", body: "Verify clause 4.2 liability cap before final signature.", status: "PENDING" as const, objectType: "DEAL" as const, dealId: relianceDeal.id, ownerId: user.id, dueDate: tomorrow },
    { type: "TASK" as const, subject: "Quarterly CISO Review with Infosys Security Labs", body: "Review cloud pentest findings and remediation roadmap.", status: "PENDING" as const, objectType: "CONTACT" as const, accountId: infosysAcc.id, ownerId: user.id, dueDate: nextWeek },
  ];

  for (const act of activitiesData) {
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
          status: act.status,
          objectType: act.objectType,
          accountId: act.accountId,
          dealId: act.dealId,
          ownerId: act.ownerId,
          dueDate: act.dueDate,
          completedDate: act.completedDate,
        },
      });
    }
  }

  // 13. Notes
  const notesData = [
    { body: "HDFC CTO confirmed executive board has allocated ₹5M budget for security upgrade.", accountId: hdfcAcc.id, authorId: user.id },
    { body: "Priya Nair accepted final SOC contract terms. Legal team preparing final signature documents.", accountId: relianceAcc.id, authorId: user.id },
    { body: "Competitor bid is 10% lower, but our automated compliance reporting is a major advantage.", accountId: tataAcc.id, authorId: user.id },
  ];

  for (const nt of notesData) {
    const exists = await prisma.note.findFirst({
      where: { tenantId: tenant.id, body: nt.body },
    });
    if (!exists) {
      await prisma.note.create({
        data: {
          tenantId: tenant.id,
          body: nt.body,
          accountId: nt.accountId,
          authorId: nt.authorId,
        },
      });
    }
  }

  // 14. Forecast
  const currentPeriod = "2026-08";
  await prisma.forecastTarget.upsert({
    where: {
      tenantId_ownerId_period: {
        tenantId: tenant.id,
        ownerId: user.id,
        period: currentPeriod,
      },
    },
    update: { targetAmount: 6000000 },
    create: {
      tenantId: tenant.id,
      ownerId: user.id,
      period: currentPeriod,
      targetAmount: 6000000,
    },
  });

  // 15. Notifications
  const notificationsData = [
    { message: "Quote Q-001 was accepted by Reliance Digital Solutions.", link: "/quotes" },
    { message: "Hot lead Rajesh Gupta (Score: 85) was assigned to you.", link: "/leads" },
    { message: "Deal 'Reliance Annual Managed SOC Contract' was closed won for ₹5,000,000! 🎉", link: "/deals" },
    { message: "Task 'Prepare Custom Security Audit Proposal for Tata Cloud' is due today.", link: "/tasks" },
  ];

  for (const notif of notificationsData) {
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        message: notif.message,
        link: notif.link,
      },
    });
  }

  console.log("✅ Successfully populated all tabs for d@gmail.com!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding d@gmail.com:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
