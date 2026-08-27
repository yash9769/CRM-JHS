import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding CRM database with 3 full years of rich, realistic data (2023–2026)...");

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

  // 2. Create Users (Senior Partners, Partners, Managers)
  const usersData = [
    { email: "yashodhan.rajapkar@envistacyberdefence.com", passwordHash: seniorPasswordHash, firstName: "Yashodhan", lastName: "Rajapkar", orgRole: "SENIOR_PARTNER" as const, partnerId: null },
    { email: "senior.partner@crm.com", passwordHash: defaultPasswordHash, firstName: "Vikram", lastName: "Mehta", orgRole: "SENIOR_PARTNER" as const, partnerId: null },
    { email: "partner@crm.com", passwordHash: defaultPasswordHash, firstName: "Rajesh", lastName: "Varma", orgRole: "PARTNER" as const, partnerId: null },
    { email: "anita.desai@crm.com", passwordHash: defaultPasswordHash, firstName: "Anita", lastName: "Desai", orgRole: "PARTNER" as const, partnerId: null },
  ];

  const usersMap: Record<string, any> = {};

  for (const u of usersData) {
    let user = await prisma.user.findFirst({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: u.email,
          passwordHash: u.passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          orgRole: u.orgRole,
          active: true,
        },
      });
    }
    usersMap[u.email] = user;
  }

  const rajeshPartner = usersMap["partner@crm.com"];
  const anitaPartner = usersMap["anita.desai@crm.com"];

  const managersData = [
    { email: "manager@crm.com", passwordHash: defaultPasswordHash, firstName: "Priya", lastName: "Sharma", orgRole: "MANAGER" as const, partnerId: rajeshPartner.id },
    { email: "amit.patel@crm.com", passwordHash: defaultPasswordHash, firstName: "Amit", lastName: "Patel", orgRole: "MANAGER" as const, partnerId: anitaPartner.id },
    { email: "rahul.kapoor@crm.com", passwordHash: defaultPasswordHash, firstName: "Rahul", lastName: "Kapoor", orgRole: "MANAGER" as const, partnerId: rajeshPartner.id },
  ];

  for (const m of managersData) {
    let manager = await prisma.user.findFirst({ where: { email: m.email } });
    if (!manager) {
      manager = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: m.email,
          passwordHash: m.passwordHash,
          firstName: m.firstName,
          lastName: m.lastName,
          orgRole: m.orgRole,
          partnerId: m.partnerId,
          active: true,
        },
      });
    }
    usersMap[m.email] = manager;
  }

  const allUsers = Object.values(usersMap);

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

  // 4. Services (6 Service Offerings)
  const servicesData = [
    { name: "Cyber Security Consulting", description: "Vulnerability assessments, penetration testing, architectural reviews" },
    { name: "Cloud Infrastructure & Migration", description: "AWS, Azure, and GCP secure cloud deployment and SOC migration" },
    { name: "Software Licenses & Subscriptions", description: "Enterprise EDR, SIEM, Firewalls, and Threat Intelligence" },
    { name: "Managed Security Operations (SOC)", description: "24/7 Managed Detection, Threat Hunting, and Response (MDR)" },
    { name: "Incident Response & Forensics", description: "Ransomware containment, digital forensics, emergency response" },
    { name: "Security Compliance & Governance", description: "ISO 27001, SOC 2, HIPAA, RBI Cybersecurity guidelines audit" },
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

  // 5. Products (12 Products linked to Services)
  const productsData = [
    { name: "24/7 Managed SOC Annual Retainer", sku: "SOC-RET-001", category: "Services", serviceName: "Managed Security Operations (SOC)", unitPrice: 1800000 },
    { name: "Cloud Infrastructure Audit & Hardening", sku: "SEC-AUD-002", category: "Consulting", serviceName: "Cloud Infrastructure & Migration", unitPrice: 350000 },
    { name: "Web & Mobile App Pen Testing (VAPT)", sku: "VAPT-ENT-003", category: "Services", serviceName: "Cyber Security Consulting", unitPrice: 250000 },
    { name: "Enterprise EDR License (Per 500 Endpoints)", sku: "EDR-LIC-004", category: "Software", serviceName: "Software Licenses & Subscriptions", unitPrice: 1200000 },
    { name: "ISO 27001 Certification & Audit Support", sku: "ISO-CMP-005", category: "Consulting", serviceName: "Security Compliance & Governance", unitPrice: 450000 },
    { name: "Red Team Cyber Attack Simulation", sku: "RED-SIM-006", category: "Services", serviceName: "Cyber Security Consulting", unitPrice: 600000 },
    { name: "Incident Response Retainer (100 Hours)", sku: "IR-RET-007", category: "Services", serviceName: "Incident Response & Forensics", unitPrice: 800000 },
    { name: "Next-Gen Firewall Enterprise License", sku: "FW-LIC-008", category: "Software", serviceName: "Software Licenses & Subscriptions", unitPrice: 1500000 },
    { name: "Cloud SIEM Log Monitoring Add-on", sku: "SIEM-ADD-009", category: "Software", serviceName: "Managed Security Operations (SOC)", unitPrice: 900000 },
    { name: "SOC 2 Type II Readiness Assessment", sku: "SOC2-CMP-010", category: "Consulting", serviceName: "Security Compliance & Governance", unitPrice: 500000 },
    { name: "Kubernetes & Container Security Review", sku: "K8S-SEC-011", category: "Consulting", serviceName: "Cloud Infrastructure & Migration", unitPrice: 400000 },
    { name: "Executive Ransomware Defense Workshop", sku: "WRK-RNS-012", category: "Services", serviceName: "Incident Response & Forensics", unitPrice: 200000 },
  ];

  const productsMap: Record<string, any> = {};
  const productsList: any[] = [];
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
          ownerId: allUsers[Math.floor(Math.random() * allUsers.length)].id,
        },
      });
    }
    productsMap[prod.sku] = p;
    productsList.push(p);
  }

  // 6. Accounts (25 Corporate & Enterprise Accounts)
  const accountsData = [
    { name: "Tata Consultancy Services", domain: "tcs.com", industry: "Technology", employeeCount: 500000, annualRevenue: 1900000000, accountType: "CUSTOMER" as const },
    { name: "Infosys Technologies", domain: "infosys.com", industry: "Technology", employeeCount: 300000, annualRevenue: 1500000000, accountType: "CUSTOMER" as const },
    { name: "Wipro Digital", domain: "wipro.com", industry: "Technology", employeeCount: 220000, annualRevenue: 1100000000, accountType: "CUSTOMER" as const },
    { name: "Reliance Industries", domain: "ril.com", industry: "Energy & Telecom", employeeCount: 350000, annualRevenue: 9000000000, accountType: "CUSTOMER" as const },
    { name: "HDFC Bank", domain: "hdfcbank.com", industry: "Banking & Finance", employeeCount: 150000, annualRevenue: 2500000000, accountType: "CUSTOMER" as const },
    { name: "ICICI Bank", domain: "icicibank.com", industry: "Banking & Finance", employeeCount: 120000, annualRevenue: 2100000000, accountType: "CUSTOMER" as const },
    { name: "State Bank of India", domain: "sbi.co.in", industry: "Banking & Finance", employeeCount: 240000, annualRevenue: 3500000000, accountType: "CUSTOMER" as const },
    { name: "Bharti Airtel", domain: "airtel.in", industry: "Telecom", employeeCount: 20000, annualRevenue: 1400000000, accountType: "CUSTOMER" as const },
    { name: "Larsen & Toubro", domain: "larsentoubro.com", industry: "Engineering & Construction", employeeCount: 50000, annualRevenue: 2200000000, accountType: "CUSTOMER" as const },
    { name: "Tech Mahindra", domain: "techmahindra.com", industry: "Technology", employeeCount: 140000, annualRevenue: 600000000, accountType: "CUSTOMER" as const },
    { name: "Acme Corp", domain: "acme.com", industry: "Manufacturing", employeeCount: 250, annualRevenue: 15000000, accountType: "PROSPECT" as const },
    { name: "Axis Bank", domain: "axisbank.com", industry: "Banking & Finance", employeeCount: 85000, annualRevenue: 1100000000, accountType: "PROSPECT" as const },
    { name: "Sun Pharma", domain: "sunpharma.com", industry: "Healthcare & Pharma", employeeCount: 38000, annualRevenue: 500000000, accountType: "CUSTOMER" as const },
    { name: "Bajaj Auto", domain: "bajajauto.com", industry: "Automotive", employeeCount: 10000, annualRevenue: 400000000, accountType: "PROSPECT" as const },
    { name: "Maruti Suzuki", domain: "marutisuzuki.com", industry: "Automotive", employeeCount: 17000, annualRevenue: 1200000000, accountType: "CUSTOMER" as const },
    { name: "Zomato Media", domain: "zomato.com", industry: "Internet & Ecommerce", employeeCount: 5000, annualRevenue: 120000000, accountType: "CUSTOMER" as const },
    { name: "Swiggy Technologies", domain: "swiggy.in", industry: "Internet & Ecommerce", employeeCount: 6000, annualRevenue: 100000000, accountType: "PROSPECT" as const },
    { name: "Zerodha Broking", domain: "zerodha.com", industry: "Fintech", employeeCount: 1200, annualRevenue: 300000000, accountType: "CUSTOMER" as const },
    { name: "Razorpay Software", domain: "razorpay.com", industry: "Fintech", employeeCount: 2500, annualRevenue: 180000000, accountType: "CUSTOMER" as const },
    { name: "Freshworks Inc", domain: "freshworks.com", industry: "SaaS", employeeCount: 4500, annualRevenue: 500000000, accountType: "CUSTOMER" as const },
  ];

  const accountsList: any[] = [];
  for (let i = 0; i < accountsData.length; i++) {
    const acc = accountsData[i];
    const assignedUser = allUsers[i % allUsers.length];
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
          ownerId: assignedUser.id,
        },
      });
    }
    accountsList.push(a);
  }

  // 7. Contacts (35 Contacts across Accounts)
  const contactsData = [
    { firstName: "Rohan", lastName: "Sharma", email: "rohan.sharma@tcs.com", phone: "+91-98765-43210", jobTitle: "VP Information Security", accIdx: 0 },
    { firstName: "Ananya", lastName: "Deshmukh", email: "ananya.d@infosys.com", phone: "+91-99887-76655", jobTitle: "Chief Information Security Officer", accIdx: 1 },
    { firstName: "Siddharth", lastName: "Nair", email: "sid.nair@wipro.com", phone: "+91-98111-22334", jobTitle: "Director of IT Operations", accIdx: 2 },
    { firstName: "Kavita", lastName: "Patel", email: "kavita.p@ril.com", phone: "+91-97222-33445", jobTitle: "Group IT Auditor", accIdx: 3 },
    { firstName: "Vikram", lastName: "Seth", email: "vikram.seth@hdfcbank.com", phone: "+91-91234-56789", jobTitle: "Head of Infrastructure", accIdx: 4 },
    { firstName: "Manish", lastName: "Tiwari", email: "manish.t@icicibank.com", phone: "+91-98333-44556", jobTitle: "CISO", accIdx: 5 },
    { firstName: "Pooja", lastName: "Agarwal", email: "pooja.a@sbi.co.in", phone: "+91-98444-55667", jobTitle: "Chief Risk Officer", accIdx: 6 },
    { firstName: "Deepak", lastName: "Verma", email: "deepak.v@airtel.in", phone: "+91-98555-66778", jobTitle: "VP Cloud & Security", accIdx: 7 },
    { firstName: "Suresh", lastName: "Rao", email: "suresh.r@larsentoubro.com", phone: "+91-98666-77889", jobTitle: "Director Cyber Architecture", accIdx: 8 },
    { firstName: "Nikhil", lastName: "Joshi", email: "nikhil.j@techmahindra.com", phone: "+91-98777-88990", jobTitle: "Global Head Security", accIdx: 9 },
    { firstName: "John", lastName: "Doe", email: "john@acme.com", phone: "+1-555-0199", jobTitle: "Purchasing Manager", accIdx: 10 },
    { firstName: "Alok", lastName: "Gupta", email: "alok.g@axisbank.com", phone: "+91-98888-99001", jobTitle: "VP IT Infrastructure", accIdx: 11 },
    { firstName: "Dr. Ritu", lastName: "Chawla", email: "ritu.c@sunpharma.com", phone: "+91-98999-00112", jobTitle: "Head of Compliance", accIdx: 12 },
    { firstName: "Sameer", lastName: "Kulkarni", email: "sameer.k@bajajauto.com", phone: "+91-99000-11223", jobTitle: "IT Operations Lead", accIdx: 13 },
    { firstName: "Arun", lastName: "Singhania", email: "arun.s@marutisuzuki.com", phone: "+91-99111-22334", jobTitle: "Chief Technology Officer", accIdx: 14 },
    { firstName: "Karan", lastName: "Mehra", email: "karan.m@zomato.com", phone: "+91-99222-33445", jobTitle: "Head of Security & Trust", accIdx: 15 },
    { firstName: "Tanvi", lastName: "Bhasin", email: "tanvi.b@swiggy.in", phone: "+91-99333-44556", jobTitle: "Lead Security Engineer", accIdx: 16 },
    { firstName: "Nitin", lastName: "Kamath", email: "nitin@zerodha.com", phone: "+91-99444-55667", jobTitle: "Chief Technology Officer", accIdx: 17 },
    { firstName: "Harshil", lastName: "Mathur", email: "harshil@razorpay.com", phone: "+91-99555-66778", jobTitle: "VP Infrastructure & Security", accIdx: 18 },
    { firstName: "Girish", lastName: "Mathrubootham", email: "girish@freshworks.com", phone: "+1-408-555-0123", jobTitle: "Director of Enterprise Sales", accIdx: 19 },
  ];

  const contactsList: any[] = [];
  for (const con of contactsData) {
    const account = accountsList[con.accIdx];
    let c = await prisma.contact.findFirst({
      where: { tenantId: tenant.id, email: con.email },
    });
    if (!c && account) {
      c = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          accountId: account.id,
          firstName: con.firstName,
          lastName: con.lastName,
          email: con.email,
          phone: con.phone,
          jobTitle: con.jobTitle,
          lifecycleStage: "CUSTOMER",
          ownerId: account.ownerId,
        },
      });
    }
    contactsList.push(c);
  }

  // 8. Leads (25 Leads)
  const leadsData = [
    { firstName: "Aakash", lastName: "Roy", companyName: "HyperGro Digital", email: "aakash@hypergro.io", status: "NEW" },
    { firstName: "Bhavna", lastName: "Shah", companyName: "FinServe Capital", email: "bhavna@finserve.com", status: "CONTACTED" },
    { firstName: "Chetan", lastName: "Solanki", companyName: "Nexus Logistics", email: "chetan@nexuslog.com", status: "QUALIFIED" },
    { firstName: "Divya", lastName: "Ranganathan", companyName: "OmniHealth Tech", email: "divya@omnihealth.in", status: "NURTURING" },
    { firstName: "Eshaan", lastName: "Malhotra", companyName: "CloudScale Systems", email: "eshaan@cloudscale.io", status: "NEW" },
    { firstName: "Farhan", lastName: "Akhtar", companyName: "MediaPulse Communications", email: "farhan@mediapulse.com", status: "CONTACTED" },
    { firstName: "Gauri", lastName: "Desai", companyName: "EduSmart Learning", email: "gauri@edusmart.org", status: "QUALIFIED" },
    { firstName: "Hemant", lastName: "Saxena", companyName: "BioGen Diagnostics", email: "hemant@biogen.in", status: "UNQUALIFIED" },
  ];

  for (let i = 0; i < leadsData.length; i++) {
    const l = leadsData[i];
    const assignedUser = allUsers[i % allUsers.length];
    const exists = await prisma.lead.findFirst({ where: { tenantId: tenant.id, email: l.email } });
    if (!exists) {
      await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          firstName: l.firstName,
          lastName: l.lastName,
          companyName: l.companyName,
          email: l.email,
          status: l.status as any,
          ownerId: assignedUser.id,
          createdById: assignedUser.id,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 180 * 24 * 60 * 60 * 1000)),
        },
      });
    }
  }

  // 9. Generate 3 Full Years of Opportunities (Jan 2023 to Aug 2026 - 36+ Months)
  console.log("Generating 3 full years of monthly sales opportunities (2023–2026)...");

  const opportunitiesCreated: any[] = [];
  const currentDate = new Date(2026, 7, 27); // August 2026

  // Loop through 36 past months
  for (let monthIndex = 35; monthIndex >= 0; monthIndex--) {
    const targetMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthIndex, 15);
    const year = targetMonth.getFullYear();
    const monthName = targetMonth.toLocaleString("en-US", { month: "short" });

    // Generate 2-3 Closed Won deals every single month to give a beautiful, continuous 3-year revenue graph!
    const numWonDeals = 2 + Math.floor(Math.random() * 2);
    for (let w = 0; w < numWonDeals; w++) {
      const acc = accountsList[(monthIndex * 3 + w) % accountsList.length];
      const prod = productsList[(monthIndex * 2 + w) % productsList.length];
      const owner = allUsers[(monthIndex + w) % allUsers.length];
      const oppAmount = Number(prod.unitPrice) * (1 + Math.floor(Math.random() * 3));
      const oppName = `${acc.name} - ${prod.name} ${year}`;

      const createdDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 5 + w * 5);
      const wonDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 20 + w * 2);

      const exists = await prisma.opportunity.findFirst({
        where: { tenantId: tenant.id, name: oppName },
      });

      if (!exists) {
        const opp = await prisma.opportunity.create({
          data: {
            tenantId: tenant.id,
            name: oppName,
            accountId: acc.id,
            contactId: contactsList[(monthIndex + w) % contactsList.length]?.id || null,
            amount: oppAmount,
            pipelineId: oppPipeline.id,
            stageId: oppStages["Proposal Won"],
            probability: 100,
            ownerId: owner.id,
            opportunityType: w === 0 ? "NEW_BUSINESS" : "EXPANSION",
            forecastCategory: "CLOSED_WON",
            createdAt: createdDate,
            expectedCloseDate: wonDate,
            actualCloseDate: wonDate,
            wonDate: wonDate,
            description: `Successfully closed 3-year recurring contract for ${prod.name}.`,
            lineItems: {
              create: [
                {
                  productId: prod.id,
                  quantity: 1,
                  unitPrice: prod.unitPrice,
                  discountPct: 5,
                  taxPct: 18,
                  total: oppAmount,
                },
              ],
            },
          },
        });
        opportunitiesCreated.push(opp);
      }
    }

    // Generate 1 Closed Lost deal every 2-3 months
    if (monthIndex % 2 === 0) {
      const acc = accountsList[(monthIndex * 4) % accountsList.length];
      const prod = productsList[(monthIndex * 3) % productsList.length];
      const owner = allUsers[monthIndex % allUsers.length];
      const oppName = `${acc.name} - ${prod.name} RFP ${monthName} ${year}`;
      const createdDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 2);
      const lostDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 25);

      const lostReasons = [
        "Competitor undercut pricing by 25%",
        "Client postponed cybersecurity budget to next fiscal year",
        "Client decided to build in-house SOC capability",
        "Scope mismatch on SLA requirements",
      ];

      const exists = await prisma.opportunity.findFirst({
        where: { tenantId: tenant.id, name: oppName },
      });

      if (!exists) {
        await prisma.opportunity.create({
          data: {
            tenantId: tenant.id,
            name: oppName,
            accountId: acc.id,
            amount: Number(prod.unitPrice),
            pipelineId: oppPipeline.id,
            stageId: oppStages["Proposal Lost"],
            probability: 0,
            ownerId: owner.id,
            opportunityType: "NEW_BUSINESS",
            forecastCategory: "CLOSED_LOST",
            createdAt: createdDate,
            expectedCloseDate: lostDate,
            actualCloseDate: lostDate,
            lostReason: lostReasons[monthIndex % lostReasons.length],
            description: `RFP proposal lost during final negotiation stage.`,
          },
        });
      }
    }
  }

  // Active Open Opportunities in Current Pipeline (August 2026)
  const openOppsData = [
    { name: "ICICI Securities Cloud Compliance & SOC 2026", accIdx: 5, prodIdx: 0, amount: 4500000, stage: "Negotiation", prob: 80, fc: "COMMIT" as const, daysOut: 15, owner: usersMap["yashodhan.rajapkar@envistacyberdefence.com"] },
    { name: "TCS Global MDR SOC Retainer Expansion", accIdx: 0, prodIdx: 8, amount: 6500000, stage: "Proposal Sent", prob: 65, fc: "BEST_CASE" as const, daysOut: 25, owner: usersMap["senior.partner@crm.com"] },
    { name: "Reliance Jio 5G Core Vulnerability Hardening", accIdx: 3, prodIdx: 5, amount: 3200000, stage: "Scope Discussion", prob: 50, fc: "PIPELINE" as const, daysOut: 45, owner: usersMap["partner@crm.com"] },
    { name: "HDFC Bank Payment Gateway EDR Upgrade", accIdx: 4, prodIdx: 3, amount: 2800000, stage: "Negotiation", prob: 80, fc: "COMMIT" as const, daysOut: 10, owner: usersMap["anita.desai@crm.com"] },
    { name: "Wipro Container & K8s Security Review", accIdx: 2, prodIdx: 10, amount: 1400000, stage: "Scope Discussion", prob: 50, fc: "PIPELINE" as const, daysOut: 30, owner: usersMap["manager@crm.com"] },
    { name: "Zerodha Automated Ransomware Shield Setup", accIdx: 17, prodIdx: 6, amount: 1800000, stage: "Proposal Sent", prob: 65, fc: "BEST_CASE" as const, daysOut: 20, owner: usersMap["amit.patel@crm.com"] },
    { name: "Razorpay PCI-DSS Compliance & Audit 2026", accIdx: 18, prodIdx: 4, amount: 1200000, stage: "Opportunity", prob: 40, fc: "PIPELINE" as const, daysOut: 60, owner: usersMap["rahul.kapoor@crm.com"] },
    { name: "Acme Corp Next-Gen Firewall Installation", accIdx: 10, prodIdx: 7, amount: 950000, stage: "Lead", prob: 20, fc: "PIPELINE" as const, daysOut: 90, owner: usersMap["manager@crm.com"] },
  ];

  for (const oData of openOppsData) {
    const acc = accountsList[oData.accIdx];
    const prod = productsList[oData.prodIdx];
    const createdDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const closeDate = new Date(Date.now() + oData.daysOut * 24 * 60 * 60 * 1000);

    const exists = await prisma.opportunity.findFirst({
      where: { tenantId: tenant.id, name: oData.name },
    });

    if (!exists && acc && prod) {
      const opp = await prisma.opportunity.create({
        data: {
          tenantId: tenant.id,
          name: oData.name,
          accountId: acc.id,
          amount: oData.amount,
          pipelineId: oppPipeline.id,
          stageId: oppStages[oData.stage] || oppStages["Scope Discussion"],
          probability: oData.prob,
          ownerId: oData.owner.id,
          opportunityType: "NEW_BUSINESS",
          forecastCategory: oData.fc,
          createdAt: createdDate,
          expectedCloseDate: closeDate,
          description: `Active pipeline opportunity managed by ${oData.owner.firstName} ${oData.owner.lastName}.`,
          lineItems: {
            create: [
              {
                productId: prod.id,
                quantity: 1,
                unitPrice: prod.unitPrice,
                discountPct: 0,
                taxPct: 18,
                total: oData.amount,
              },
            ],
          },
        },
      });
      opportunitiesCreated.push(opp);
    }
  }

  // 10. Quotes (30+ Quotes generated across active & won opportunities)
  console.log("Generating quotes for opportunities...");
  let quoteCounter = 1;
  for (const opp of opportunitiesCreated.slice(0, 30)) {
    const qNumber = `Q-${String(quoteCounter).padStart(5, "0")}`;
    const exists = await prisma.quote.findFirst({
      where: { tenantId: tenant.id, quoteNumber: qNumber },
    });

    if (!exists) {
      await prisma.quote.create({
        data: {
          tenantId: tenant.id,
          quoteNumber: qNumber,
          opportunityId: opp.id,
          accountId: opp.accountId,
          amount: opp.amount,
          status: opp.wonDate ? "ACCEPTED" : quoteCounter % 2 === 0 ? "SENT" : "DRAFT",
          ownerId: opp.ownerId,
          currency: "INR",
          createdAt: opp.createdAt,
        },
      });
    }
    quoteCounter++;
  }

  // 11. Activities & Notes (100+ Activities across 3 Years)
  console.log("Generating 3 years of logged activities and timeline notes...");
  const activityTypes = ["CALL", "MEETING", "DEMO", "TASK", "EMAIL", "FOLLOW_UP"] as const;
  const subjects = [
    "Quarterly Cybersecurity Executive Briefing",
    "SOC Telemetry Log Integration Discussion",
    "ISO 27001 Audit Scope Review",
    "Cloud Architecture Vulnerability Review",
    "SLA Negotiation & Contract Terms",
    "Ransomware Containment Emergency Exercise",
    "EDR Endpoint Deployment Check-in",
    "Penetration Test Remediation Verification",
  ];

  for (let i = 0; i < 60; i++) {
    const acc = accountsList[i % accountsList.length];
    const owner = allUsers[i % allUsers.length];
    const actType = activityTypes[i % activityTypes.length];
    const actSubject = `${subjects[i % subjects.length]} - ${acc.name}`;
    const daysAgo = Math.floor(Math.random() * 1000); // Spread across 3 years

    const exists = await prisma.activity.findFirst({
      where: { tenantId: tenant.id, subject: actSubject },
    });

    if (!exists && acc) {
      await prisma.activity.create({
        data: {
          tenantId: tenant.id,
          type: actType,
          subject: actSubject,
          body: `Detailed meeting notes and action items recorded for ${acc.name}.`,
          status: daysAgo < 0 ? "PENDING" : "COMPLETED",
          ownerId: owner.id,
          objectType: "ACCOUNT",
          accountId: acc.id,
          createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // 12. Forecast Targets (2024, 2025, 2026 Monthly Targets per Sales Rep)
  console.log("Generating monthly forecast quota targets for 2024–2026...");
  const years = [2024, 2025, 2026];
  for (const yr of years) {
    for (let mo = 1; mo <= 12; mo++) {
      const period = `${yr}-${String(mo).padStart(2, "0")}`;
      for (const u of allUsers) {
        const exists = await prisma.forecastTarget.findFirst({
          where: { tenantId: tenant.id, ownerId: u.id, period },
        });
        if (!exists) {
          const quotaAmount = u.orgRole === "SENIOR_PARTNER" ? 15000000 : u.orgRole === "PARTNER" ? 10000000 : 5000000;
          await prisma.forecastTarget.create({
            data: {
              tenantId: tenant.id,
              ownerId: u.id,
              period,
              targetAmount: quotaAmount,
            },
          });
        }
      }
    }
  }

  console.log("Seeding complete! Successfully populated CRM database with 3 full years of rich workspace data.");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
