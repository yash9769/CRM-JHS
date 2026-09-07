import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Opportunity data population and reconciliation...");

  // 1. Fetch Tenant
  const tenant = await prisma.tenant.findFirst({
    where: { name: "Envista Cyber Defence" },
  });

  if (!tenant) {
    throw new Error("Tenant 'Envista Cyber Defence' not found!");
  }
  console.log(`Using Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Fetch Opportunity Pipeline and all 9 Stages
  const oppPipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, type: "OPPORTUNITY" },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  if (!oppPipeline) {
    throw new Error("Opportunity Pipeline not found!");
  }

  const stagesMap: Record<string, { id: string; name: string; order: number; probability: number }> = {};
  for (const st of oppPipeline.stages) {
    stagesMap[st.name] = { id: st.id, name: st.name, order: st.order, probability: st.probability };
  }

  const expectedStages = [
    "Prospect",
    "Lead",
    "Marketing Qualified Lead",
    "Scope Discussion",
    "Proposal Sent",
    "Negotiation",
    "Closed Won",
    "Closed Lost",
    "Opportunity Dead",
  ];

  for (const sName of expectedStages) {
    if (!stagesMap[sName]) {
      throw new Error(`Missing expected stage in pipeline: ${sName}`);
    }
  }
  console.log("Found all 9 pipeline stages.");

  // 3. Fetch all Accounts, Users, and Products
  const accounts = await prisma.account.findMany({
    where: { tenantId: tenant.id },
    include: { contacts: true },
  });
  if (accounts.length === 0) {
    throw new Error("No accounts found!");
  }

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id, active: true },
  });
  if (users.length === 0) {
    throw new Error("No active users found!");
  }

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id },
  });

  console.log(`Found ${accounts.length} accounts, ${users.length} users, and ${products.length} products.`);

  // 4. Define Targeted Seed Opportunities across all 9 Stages
  interface OppSeedConfig {
    name: string;
    stageName: string;
    accountIndex: number;
    userIndex: number;
    productIndex: number;
    expectedValue: number;
    actualValue: number | null;
    costRatio: number | null; // null if no bottomLineCost
    opportunityType: "NEW_BUSINESS" | "EXPANSION" | "RENEWAL";
    forecastCategory: "PIPELINE" | "BEST_CASE" | "COMMIT" | "CLOSED_WON" | "CLOSED_LOST";
    probability: number;
    daysOut: number; // positive for future, negative for past
    lostReason?: string;
    description: string;
  }

  const targetOpportunities: OppSeedConfig[] = [
    // -------------------------------------------------------------------------
    // 1. PROSPECT (order 1, prob 10%, fc PIPELINE, actualValue=null, cost=null)
    // -------------------------------------------------------------------------
    {
      name: "Tata Consultancy Services - AI Red Teaming & LLM Security Assessment",
      stageName: "Prospect",
      accountIndex: 0,
      userIndex: 0,
      productIndex: 5,
      expectedValue: 1850000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 10,
      daysOut: 90,
      description: "Initial discovery discussion for LLM red teaming and adversarial prompt injection testing across enterprise generative AI apps.",
    },
    {
      name: "Infosys Technologies - OT & IoT Infrastructure Security Audit",
      stageName: "Prospect",
      accountIndex: 1,
      userIndex: 1,
      productIndex: 1,
      expectedValue: 1200000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 10,
      daysOut: 100,
      description: "Exploratory evaluation of smart campus IoT gateways and OT network architecture security posture.",
    },
    {
      name: "Wipro Digital - Zero Trust Architecture Readiness Assessment",
      stageName: "Prospect",
      accountIndex: 2,
      userIndex: 2,
      productIndex: 9,
      expectedValue: 2400000,
      actualValue: null,
      costRatio: null,
      opportunityType: "EXPANSION",
      forecastCategory: "PIPELINE",
      probability: 10,
      daysOut: 110,
      description: "Preliminary scoping for enterprise-wide Zero Trust network access (ZTNA) migration roadmap.",
    },
    {
      name: "Reliance Industries - Supply Chain Cyber Risk Rating Review",
      stageName: "Prospect",
      accountIndex: 3,
      userIndex: 3,
      productIndex: 4,
      expectedValue: 3200000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 10,
      daysOut: 120,
      description: "Initial engagement regarding third-party vendor assessment and third-party risk management software suite.",
    },
    {
      name: "HDFC Bank - SWIFT Payment Gateway Vulnerability Inspection",
      stageName: "Prospect",
      accountIndex: 4,
      userIndex: 4,
      productIndex: 2,
      expectedValue: 1500000,
      actualValue: null,
      costRatio: null,
      opportunityType: "RENEWAL",
      forecastCategory: "PIPELINE",
      probability: 10,
      daysOut: 80,
      description: "Early-stage alignment on annual SWIFT customer security programme (CSCF) independent compliance audit.",
    },

    // -------------------------------------------------------------------------
    // 2. LEAD (order 2, prob 20%, fc PIPELINE, actualValue=null, cost=null)
    // -------------------------------------------------------------------------
    {
      name: "ICICI Bank - Cloud Workload Protection (CWPP) Platform Implementation",
      stageName: "Lead",
      accountIndex: 5,
      userIndex: 5,
      productIndex: 1,
      expectedValue: 2800000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 20,
      daysOut: 75,
      description: "Inbound inquiry from CISO office seeking multi-cloud Kubernetes workload runtime defense.",
    },
    {
      name: "State Bank of India - Perimeter DDoS & API Gateway Hardening",
      stageName: "Lead",
      accountIndex: 6,
      userIndex: 6,
      productIndex: 7,
      expectedValue: 3600000,
      actualValue: null,
      costRatio: null,
      opportunityType: "EXPANSION",
      forecastCategory: "PIPELINE",
      probability: 20,
      daysOut: 85,
      description: "Discussion on high-volume DDoS mitigation architecture and API gateway rate-limiting appliances.",
    },
    {
      name: "Bharti Airtel - Telecom Core 5G Slice Security Assessment",
      stageName: "Lead",
      accountIndex: 7,
      userIndex: 0,
      productIndex: 2,
      expectedValue: 4200000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 20,
      daysOut: 70,
      description: "Scoping requirements for dedicated 5G core network slice isolation and penetration testing.",
    },
    {
      name: "Larsen & Toubro - Industrial SCADA & DCS Penetration Testing",
      stageName: "Lead",
      accountIndex: 8,
      userIndex: 1,
      productIndex: 2,
      expectedValue: 1750000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 20,
      daysOut: 90,
      description: "Lead identified for offensive cyber assessment of thermal plant SCADA automation controllers.",
    },
    {
      name: "Tech Mahindra - Identity Threat Detection & Response (ITDR)",
      stageName: "Lead",
      accountIndex: 9,
      userIndex: 2,
      productIndex: 3,
      expectedValue: 2100000,
      actualValue: null,
      costRatio: null,
      opportunityType: "RENEWAL",
      forecastCategory: "PIPELINE",
      probability: 20,
      daysOut: 65,
      description: "Active discussions around Active Directory privilege escalation defense and credential stuffing mitigation.",
    },

    // -------------------------------------------------------------------------
    // 3. MARKETING QUALIFIED LEAD (order 3, prob 30%, fc PIPELINE, actualValue=null, cost=null)
    // -------------------------------------------------------------------------
    {
      name: "Acme Corp - Next-Gen SIEM Migration & Threat Hunting Onboarding",
      stageName: "Marketing Qualified Lead",
      accountIndex: 10,
      userIndex: 3,
      productIndex: 8,
      expectedValue: 2600000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 30,
      daysOut: 60,
      description: "Qualified by cybersecurity webinar campaign; customer evaluating replacement of legacy on-prem SIEM.",
    },
    {
      name: "Axis Bank - Enterprise Secrets Management & Vault Deployment",
      stageName: "Marketing Qualified Lead",
      accountIndex: 11,
      userIndex: 4,
      productIndex: 1,
      expectedValue: 3100000,
      actualValue: null,
      costRatio: null,
      opportunityType: "EXPANSION",
      forecastCategory: "PIPELINE",
      probability: 30,
      daysOut: 55,
      description: "Demo requested for centralized API keys, PKI certificates, and database credential rotation.",
    },
    {
      name: "Sun Pharma - GxP Compliance & FDA Part 11 Electronic Records Audit",
      stageName: "Marketing Qualified Lead",
      accountIndex: 12,
      userIndex: 5,
      productIndex: 4,
      expectedValue: 1900000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 30,
      daysOut: 65,
      description: "Pharma laboratory data integrity and 21 CFR Part 11 electronic signature audit engagement lead.",
    },
    {
      name: "Bajaj Auto - Connected Vehicle Telematics Cloud Vulnerability Assessment",
      stageName: "Marketing Qualified Lead",
      accountIndex: 13,
      userIndex: 6,
      productIndex: 2,
      expectedValue: 2250000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 30,
      daysOut: 70,
      description: "Inquiry generated from auto-tech expo on CAN bus messaging and connected EV cloud API security.",
    },
    {
      name: "Maruti Suzuki - Ransomware Resilience & Offline Backup Architecture",
      stageName: "Marketing Qualified Lead",
      accountIndex: 14,
      userIndex: 0,
      productIndex: 11,
      expectedValue: 1400000,
      actualValue: null,
      costRatio: null,
      opportunityType: "EXPANSION",
      forecastCategory: "PIPELINE",
      probability: 30,
      daysOut: 50,
      description: "Manufacturing business continuity team seeking air-gapped immutable backup validation and drill.",
    },

    // -------------------------------------------------------------------------
    // 4. SCOPE DISCUSSION (order 4, prob 50%, fc PIPELINE, actualValue=null, bottomLineCost set for estimated margin)
    // -------------------------------------------------------------------------
    {
      name: "Zomato Media - Merchant Portal Microservices Pen Test",
      stageName: "Scope Discussion",
      accountIndex: 15,
      userIndex: 1,
      productIndex: 2,
      expectedValue: 1600000,
      actualValue: null,
      costRatio: 0.54, // Expected margin = 46%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 50,
      daysOut: 40,
      description: "Scoping 45 backend microservices, GraphQL endpoints, and driver mobile apps for quarterly security release.",
    },
    {
      name: "Swiggy Technologies - Real-Time Fraud & Promo Abuse Engine Audit",
      stageName: "Scope Discussion",
      accountIndex: 16,
      userIndex: 2,
      productIndex: 10,
      expectedValue: 2400000,
      actualValue: null,
      costRatio: 0.62, // Expected margin = 38%
      opportunityType: "EXPANSION",
      forecastCategory: "PIPELINE",
      probability: 50,
      daysOut: 45,
      description: "Evaluating architectural bypasses and coupon code bot attacks on consumer food delivery backend.",
    },
    {
      name: "Zerodha Broking - High-Frequency Trading Protocol Encryption Scoping",
      stageName: "Scope Discussion",
      accountIndex: 17,
      userIndex: 3,
      productIndex: 1,
      expectedValue: 3800000,
      actualValue: null,
      costRatio: 0.50, // Expected margin = 50%
      opportunityType: "EXPANSION",
      forecastCategory: "PIPELINE",
      probability: 50,
      daysOut: 35,
      description: "Low-latency trading gateway cryptographic review, wire protocol fuzzing, and broker OMS testing.",
    },
    {
      name: "Razorpay Software - ISO 27701 Privacy Information Management System",
      stageName: "Scope Discussion",
      accountIndex: 18,
      userIndex: 4,
      productIndex: 4,
      expectedValue: 1800000,
      actualValue: null,
      costRatio: 0.58, // Expected margin = 42%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "PIPELINE",
      probability: 50,
      daysOut: 50,
      description: "Scoping cross-border personal data governance and privacy audit to prepare for global market expansion.",
    },
    {
      name: "Freshworks Inc - SaaS Multi-Tenant Database Encryption Scoping",
      stageName: "Scope Discussion",
      accountIndex: 19,
      userIndex: 5,
      productIndex: 1,
      expectedValue: 2900000,
      actualValue: null,
      costRatio: 0.65, // Expected margin = 35%
      opportunityType: "RENEWAL",
      forecastCategory: "PIPELINE",
      probability: 50,
      daysOut: 30,
      description: "Technical review of PostgreSQL column-level KMS encryption across 4 AWS geographic regions.",
    },

    // -------------------------------------------------------------------------
    // 5. PROPOSAL SENT (order 5, prob 65%, fc BEST_CASE, actualValue set, cost set)
    // -------------------------------------------------------------------------
    {
      name: "Tata Consultancy Services - 24/7 Managed SOC Enterprise Expansion",
      stageName: "Proposal Sent",
      accountIndex: 0,
      userIndex: 6,
      productIndex: 0,
      expectedValue: 5400000,
      actualValue: 5200000, // Commercial proposal sent
      costRatio: 0.56,      // 56% -> Margin = 44.0%
      opportunityType: "EXPANSION",
      forecastCategory: "BEST_CASE",
      probability: 65,
      daysOut: 25,
      description: "Proposal submitted for 24/7 Managed Detection and Response across 2,500 hybrid server endpoints.",
    },
    {
      name: "Infosys Technologies - Enterprise EDR 5,000 Endpoint License Bundle",
      stageName: "Proposal Sent",
      accountIndex: 1,
      userIndex: 0,
      productIndex: 3,
      expectedValue: 4800000,
      actualValue: 4500000,
      costRatio: 0.68,      // 68% -> Margin = 32.0%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "BEST_CASE",
      probability: 65,
      daysOut: 20,
      description: "Official RFP proposal submitted including 3-year Tier 3 engineering support SLA.",
    },
    {
      name: "Wipro Digital - Cloud Infrastructure SOC 2 & FedRAMP Alignment",
      stageName: "Proposal Sent",
      accountIndex: 2,
      userIndex: 1,
      productIndex: 9,
      expectedValue: 3500000,
      actualValue: 3500000,
      costRatio: 0.50,      // 50% -> Margin = 50.0%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "BEST_CASE",
      probability: 65,
      daysOut: 30,
      description: "Formal bid delivered to enterprise compliance committee for US public sector cloud certification.",
    },
    {
      name: "Reliance Industries - Red Team Threat Simulation for Refinery DCS",
      stageName: "Proposal Sent",
      accountIndex: 3,
      userIndex: 2,
      productIndex: 5,
      expectedValue: 2400000,
      actualValue: 2300000,
      costRatio: 0.61,      // 61% -> Margin = 39.0%
      opportunityType: "RENEWAL",
      forecastCategory: "BEST_CASE",
      probability: 65,
      daysOut: 18,
      description: "Physical and logical breach simulation proposal submitted to head of corporate security.",
    },
    {
      name: "HDFC Bank - Incident Response Retainer 200-Hour Block",
      stageName: "Proposal Sent",
      accountIndex: 4,
      userIndex: 3,
      productIndex: 6,
      expectedValue: 1600000,
      actualValue: 1600000,
      costRatio: 0.52,      // 52% -> Margin = 48.0%
      opportunityType: "RENEWAL",
      forecastCategory: "BEST_CASE",
      probability: 65,
      daysOut: 22,
      description: "Commercial pricing submitted for 15-minute emergency SLA triage and malware reversing retainer.",
    },

    // -------------------------------------------------------------------------
    // 6. NEGOTIATION (order 6, prob 80%, fc COMMIT, actualValue set, cost set)
    // -------------------------------------------------------------------------
    {
      name: "ICICI Bank - Next-Gen Firewall & Microsegmentation Licensing",
      stageName: "Negotiation",
      accountIndex: 5,
      userIndex: 4,
      productIndex: 7,
      expectedValue: 4500000,
      actualValue: 4250000, // Final negotiated deal value
      costRatio: 0.65,      // 65% -> Margin = 35.0%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "COMMIT",
      probability: 80,
      daysOut: 10,
      description: "Legal and procurement finalizing master services agreement and milestone payment schedules.",
    },
    {
      name: "State Bank of India - Core Banking Mobile App VAPT & Reverse Engineering",
      stageName: "Negotiation",
      accountIndex: 6,
      userIndex: 5,
      productIndex: 2,
      expectedValue: 2000000,
      actualValue: 1950000,
      costRatio: 0.49,      // 49% -> Margin = 51.0%
      opportunityType: "RENEWAL",
      forecastCategory: "COMMIT",
      probability: 80,
      daysOut: 7,
      description: "Scope and commercial terms agreed; final sign-off pending with Deputy Managing Director (IT).",
    },
    {
      name: "Bharti Airtel - Cloud SIEM Log Ingestion Enterprise License",
      stageName: "Negotiation",
      accountIndex: 7,
      userIndex: 6,
      productIndex: 8,
      expectedValue: 3800000,
      actualValue: 3600000,
      costRatio: 0.58,      // 58% -> Margin = 42.0%
      opportunityType: "EXPANSION",
      forecastCategory: "COMMIT",
      probability: 80,
      daysOut: 12,
      description: "Volume tier discounting finalized at 3.6M; contract routing through DocuSign.",
    },
    {
      name: "Larsen & Toubro - ISO 27001 Multi-Site Audit Support 2026",
      stageName: "Negotiation",
      accountIndex: 8,
      userIndex: 0,
      productIndex: 4,
      expectedValue: 1800000,
      actualValue: 1750000,
      costRatio: 0.53,      // 53% -> Margin = 47.0%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "COMMIT",
      probability: 80,
      daysOut: 14,
      description: "Audit itinerary agreed for 6 manufacturing facilities; legal indemnity clause review in progress.",
    },
    {
      name: "Tech Mahindra - Kubernetes Security & Cluster Admission Control",
      stageName: "Negotiation",
      accountIndex: 9,
      userIndex: 1,
      productIndex: 10,
      expectedValue: 2500000,
      actualValue: 2400000,
      costRatio: 0.63,      // 63% -> Margin = 37.0%
      opportunityType: "EXPANSION",
      forecastCategory: "COMMIT",
      probability: 80,
      daysOut: 8,
      description: "Open Policy Agent (OPA) integration deliverable approved; purchase order generation in process.",
    },

    // -------------------------------------------------------------------------
    // 7. CLOSED WON (order 7, prob 100%, fc CLOSED_WON, wonDate real past, cost set)
    // -------------------------------------------------------------------------
    {
      name: "Acme Corp - Enterprise Security Hardening & Penetration Testing",
      stageName: "Closed Won",
      accountIndex: 10,
      userIndex: 2,
      productIndex: 2,
      expectedValue: 2500000,
      actualValue: 2500000,
      costRatio: 0.51,      // 51% -> Margin = 49.0%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_WON",
      probability: 100,
      daysOut: -15, // Won 15 days ago
      description: "Executed master services contract for full network and application penetration testing.",
    },
    {
      name: "Axis Bank - SOC 2 Type II Certification Advisory Retainer",
      stageName: "Closed Won",
      accountIndex: 11,
      userIndex: 3,
      productIndex: 9,
      expectedValue: 3200000,
      actualValue: 3100000,
      costRatio: 0.57,      // 57% -> Margin = 43.0%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_WON",
      probability: 100,
      daysOut: -25, // Won 25 days ago
      description: "Signed 12-month retainer for SOC 2 Type II audit facilitation and remediation.",
    },
    {
      name: "Sun Pharma - Cloud Infrastructure Security Hardening 2026",
      stageName: "Closed Won",
      accountIndex: 12,
      userIndex: 4,
      productIndex: 1,
      expectedValue: 2800000,
      actualValue: 2800000,
      costRatio: 0.64,      // 64% -> Margin = 36.0%
      opportunityType: "EXPANSION",
      forecastCategory: "CLOSED_WON",
      probability: 100,
      daysOut: -10, // Won 10 days ago
      description: "Secured multi-region AWS pharmaceutical analytics environment; project kick-off completed.",
    },
    {
      name: "Bajaj Auto - Connected Mobility API Shield & Tokenization",
      stageName: "Closed Won",
      accountIndex: 13,
      userIndex: 5,
      productIndex: 7,
      expectedValue: 3900000,
      actualValue: 3750000,
      costRatio: 0.69,      // 69% -> Margin = 31.0%
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_WON",
      probability: 100,
      daysOut: -30, // Won 30 days ago
      description: "Delivered hardware security module (HSM) key management integration for connected vehicles.",
    },
    {
      name: "Maruti Suzuki - 24/7 Managed SOC Tier-1 Factory Fleet Retainer",
      stageName: "Closed Won",
      accountIndex: 14,
      userIndex: 6,
      productIndex: 0,
      expectedValue: 5500000,
      actualValue: 5500000,
      costRatio: 0.47,      // 47% -> Margin = 53.0%
      opportunityType: "RENEWAL",
      forecastCategory: "CLOSED_WON",
      probability: 100,
      daysOut: -5,  // Won 5 days ago
      description: "Annual renewal executed for all plant telemetry monitoring with enhanced 1-hour containment SLA.",
    },

    // -------------------------------------------------------------------------
    // 8. CLOSED LOST (order 8, prob 0%, fc CLOSED_LOST, lostReason set, actualCloseDate real past)
    // -------------------------------------------------------------------------
    {
      name: "Zomato Media - Global Cloud SIEM Log Ingestion Project",
      stageName: "Closed Lost",
      accountIndex: 15,
      userIndex: 0,
      productIndex: 8,
      expectedValue: 3400000,
      actualValue: 3200000, // Proposal went out
      costRatio: 0.60,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -40,
      lostReason: "Competitor bundled SIEM license free with their existing cloud hosting credits.",
      description: "RFP lost to cloud provider's native security bundle.",
    },
    {
      name: "Swiggy Technologies - Executive Ransomware Tabletop Exercise",
      stageName: "Closed Lost",
      accountIndex: 16,
      userIndex: 1,
      productIndex: 11,
      expectedValue: 950000,
      actualValue: null, // Died before proposal
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -60,
      lostReason: "Client leadership decided to conduct internal tabletop simulation using in-house team.",
      description: "Discovery stalled after Q2 executive committee meeting.",
    },
    {
      name: "Zerodha Broking - External Network Perimeter Pen Test Q2",
      stageName: "Closed Lost",
      accountIndex: 17,
      userIndex: 2,
      productIndex: 2,
      expectedValue: 1800000,
      actualValue: 1700000, // Proposal went out
      costRatio: 0.55,
      opportunityType: "RENEWAL",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -45,
      lostReason: "Incumbent vendor offered 25% multi-year renewal discount.",
      description: "Price sensitivity led to incumbent contract extension.",
    },
    {
      name: "Razorpay Software - Container Security Platform Procurement",
      stageName: "Closed Lost",
      accountIndex: 18,
      userIndex: 3,
      productIndex: 10,
      expectedValue: 2700000,
      actualValue: null, // Died before proposal
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -70,
      lostReason: "Client shifted engineering budget toward open-source Falco deployment.",
      description: "DevOps team chose open-source stack over managed enterprise software.",
    },
    {
      name: "Freshworks Inc - ISO 27001 Annual Recertification Audit",
      stageName: "Closed Lost",
      accountIndex: 19,
      userIndex: 4,
      productIndex: 4,
      expectedValue: 1500000,
      actualValue: 1450000,
      costRatio: 0.65,
      opportunityType: "RENEWAL",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -35,
      lostReason: "Global parent company mandated single multinational auditor for all subsidiaries.",
      description: "Disqualified due to corporate auditor consolidation policy.",
    },

    // -------------------------------------------------------------------------
    // 9. OPPORTUNITY DEAD (order 9, prob 0%, fc CLOSED_LOST, lostReason set, actualCloseDate real past)
    // -------------------------------------------------------------------------
    {
      name: "Acme Corp - Mobile App Source Code Security Review",
      stageName: "Opportunity Dead",
      accountIndex: 10,
      userIndex: 5,
      productIndex: 2,
      expectedValue: 1100000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -80,
      lostReason: "Client product manager and lead developer resigned; mobile rewrite shelved indefinitely.",
      description: "Deal marked dead after client discontinued the underlying mobile product.",
    },
    {
      name: "Tata Consultancy Services - Legacy Mainframe Security Scoping",
      stageName: "Opportunity Dead",
      accountIndex: 0,
      userIndex: 6,
      productIndex: 1,
      expectedValue: 2100000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -95,
      lostReason: "Mainframe decommissioning accelerated; security audit no longer required.",
      description: "Legacy system slated for complete sunset within 6 months.",
    },
    {
      name: "Wipro Digital - Biometric Authentication Firmware Audit",
      stageName: "Opportunity Dead",
      accountIndex: 2,
      userIndex: 0,
      productIndex: 2,
      expectedValue: 1650000,
      actualValue: null,
      costRatio: null,
      opportunityType: "EXPANSION",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -105,
      lostReason: "Unresponsive to 4 rounds of follow-ups after initial requirements workshop.",
      description: "Project abandoned due to lack of stakeholder engagement.",
    },
    {
      name: "Reliance Industries - Satellite Communication Link Encryption Scoping",
      stageName: "Opportunity Dead",
      accountIndex: 3,
      userIndex: 1,
      productIndex: 7,
      expectedValue: 4500000,
      actualValue: null,
      costRatio: null,
      opportunityType: "NEW_BUSINESS",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -120,
      lostReason: "Government telecom regulatory approval delayed indefinitely; project canceled.",
      description: "Regulatory roadblock prevented project commencement.",
    },
    {
      name: "HDFC Bank - Branch ATM Endpoint Hardening Initiative",
      stageName: "Opportunity Dead",
      accountIndex: 4,
      userIndex: 2,
      productIndex: 3,
      expectedValue: 3800000,
      actualValue: null,
      costRatio: null,
      opportunityType: "RENEWAL",
      forecastCategory: "CLOSED_LOST",
      probability: 0,
      daysOut: -90,
      lostReason: "Corporate restructuring merged ATM fleet management with external facilities vendor.",
      description: "Project scope dissolved following vendor consolidation.",
    },
  ];

  console.log(`Upserting ${targetOpportunities.length} targeted opportunities across all 9 stages...`);

  for (const cfg of targetOpportunities) {
    const stage = stagesMap[cfg.stageName];
    if (!stage) continue;

    const account = accounts[cfg.accountIndex % accounts.length];
    const user = users[cfg.userIndex % users.length];
    const product = products[cfg.productIndex % products.length];
    const contact = account.contacts[0] || null;

    const baseDate = new Date();
    const isWon = cfg.stageName === "Closed Won";
    const isClosed = isWon || cfg.stageName === "Closed Lost" || cfg.stageName === "Opportunity Dead";
    const closeDate = new Date(baseDate.getTime() + cfg.daysOut * 24 * 60 * 60 * 1000);

    // Realistic past creation dates: open opportunities were created in the past, not the future!
    const stageAgeOffset = cfg.stageName === "Prospect" ? 8 : cfg.stageName === "Lead" ? 14 : cfg.stageName === "Marketing Qualified Lead" ? 21 : cfg.stageName === "Scope Discussion" ? 27 : cfg.stageName === "Proposal Sent" ? 35 : 44;
    const createdDate = isClosed
      ? new Date(closeDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      : new Date(baseDate.getTime() - (stageAgeOffset + (cfg.accountIndex % 6) * 2) * 24 * 60 * 60 * 1000);

    const wonDate = isWon ? closeDate : null;
    const actualCloseDate = isClosed ? closeDate : null;

    const expectedVal = cfg.expectedValue;
    const actualVal = cfg.actualValue;
    const bottomCost = cfg.costRatio !== null && (actualVal !== null || expectedVal !== null)
      ? Math.round((actualVal ?? expectedVal) * cfg.costRatio)
      : null;

    const existing = await prisma.opportunity.findFirst({
      where: {
        tenantId: tenant.id,
        name: cfg.name,
      },
    });

    const oppData = {
      tenantId: tenant.id,
      name: cfg.name,
      accountId: account.id,
      contactId: contact ? contact.id : null,
      amount: expectedVal,
      expectedOpportunityValue: expectedVal,
      actualOpportunityValue: actualVal,
      bottomLineCost: bottomCost,
      pipelineId: oppPipeline.id,
      stageId: stage.id,
      probability: cfg.probability,
      ownerId: user.id,
      createdById: user.id,
      opportunityType: cfg.opportunityType,
      forecastCategory: cfg.forecastCategory,
      createdAt: createdDate,
      expectedCloseDate: closeDate,
      actualCloseDate: actualCloseDate,
      wonDate: wonDate,
      lostReason: cfg.lostReason || null,
      description: cfg.description,
    };

    if (existing) {
      await prisma.opportunity.update({
        where: { id: existing.id },
        data: oppData,
      });
    } else {
      const createdOpp = await prisma.opportunity.create({
        data: {
          ...oppData,
          lineItems: product
            ? {
                create: [
                  {
                    productId: product.id,
                    quantity: 1,
                    unitPrice: product.unitPrice,
                    discountPct: actualVal && actualVal < expectedVal ? 5 : 0,
                    taxPct: 18,
                    total: actualVal ?? expectedVal,
                  },
                ],
              }
            : undefined,
        },
      });

      if (contact) {
        await prisma.opportunityContact.upsert({
          where: {
            opportunityId_contactId: {
              opportunityId: createdOpp.id,
              contactId: contact.id,
            },
          },
          create: {
            opportunityId: createdOpp.id,
            contactId: contact.id,
            role: "Decision Maker",
          },
          update: {},
        });
      }
    }
  }

  // 5. STAGE-BY-STAGE STRICT RECONCILIATION FOR EVERY OPPORTUNITY IN TENANT
  console.log("\nApplying strict stage-by-stage consistency rules to ALL opportunities...");
  const allOpps = await prisma.opportunity.findMany({
    where: { tenantId: tenant.id },
    include: { stage: true },
  });

  const costVariations = [0.48, 0.54, 0.61, 0.67, 0.51, 0.57, 0.63, 0.50, 0.56, 0.65, 0.52, 0.59];

  for (let i = 0; i < allOpps.length; i++) {
    const opp = allOpps[i];
    const sName = opp.stage.name;
    const expVal = Math.round(Number(opp.expectedOpportunityValue || opp.amount || 1000000));
    const ratio = costVariations[i % costVariations.length];

    const stageAgeOffset = sName === "Prospect" ? 8 : sName === "Lead" ? 14 : sName === "Marketing Qualified Lead" ? 21 : sName === "Scope Discussion" ? 27 : sName === "Proposal Sent" ? 35 : sName === "Negotiation" ? 44 : 60;
    const isFutureCreated = new Date(opp.createdAt) > new Date();
    const fixedCreatedAt = isFutureCreated
      ? new Date(Date.now() - (stageAgeOffset + (i % 6) * 2) * 24 * 60 * 60 * 1000)
      : opp.createdAt;

    if (sName === "Prospect" || sName === "Lead" || sName === "Marketing Qualified Lead") {
      // Early stages: actualOpportunityValue = null, bottomLineCost = null, forecastCategory = PIPELINE
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          amount: expVal,
          expectedOpportunityValue: expVal,
          actualOpportunityValue: null,
          bottomLineCost: null,
          forecastCategory: "PIPELINE",
          probability: sName === "Prospect" ? 10 : sName === "Lead" ? 20 : 30,
          wonDate: null,
          actualCloseDate: null,
          lostReason: null,
          createdAt: fixedCreatedAt,
        },
      });
    } else if (sName === "Scope Discussion") {
      // Scope Discussion: proposal not yet sent (actualOpportunityValue = null)
      // bottomLineCost set to estimated delivery cost (48-67% of expected value) so expected margin renders
      const cost = Math.round(expVal * ratio);
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          amount: expVal,
          expectedOpportunityValue: expVal,
          actualOpportunityValue: null,
          bottomLineCost: cost,
          forecastCategory: "PIPELINE",
          probability: 50,
          wonDate: null,
          actualCloseDate: null,
          lostReason: null,
          createdAt: fixedCreatedAt,
        },
      });
    } else if (sName === "Proposal Sent") {
      // Proposal Sent: actualOpportunityValue set, bottomLineCost set
      const actVal = opp.actualOpportunityValue ? Math.round(Number(opp.actualOpportunityValue)) : expVal;
      const cost = Math.round(actVal * ratio);
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          amount: expVal,
          expectedOpportunityValue: expVal,
          actualOpportunityValue: actVal,
          bottomLineCost: cost,
          forecastCategory: "BEST_CASE",
          probability: 65,
          wonDate: null,
          actualCloseDate: null,
          lostReason: null,
          createdAt: fixedCreatedAt,
        },
      });
    } else if (sName === "Negotiation") {
      // Negotiation: actualOpportunityValue set, bottomLineCost set, forecastCategory = COMMIT
      const actVal = opp.actualOpportunityValue ? Math.round(Number(opp.actualOpportunityValue)) : expVal;
      const cost = Math.round(actVal * ratio);
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          amount: expVal,
          expectedOpportunityValue: expVal,
          actualOpportunityValue: actVal,
          bottomLineCost: cost,
          forecastCategory: "COMMIT",
          probability: 80,
          wonDate: null,
          actualCloseDate: null,
          lostReason: null,
          createdAt: fixedCreatedAt,
        },
      });
    } else if (sName === "Closed Won") {
      // Closed Won: actualOpportunityValue set, bottomLineCost set, forecastCategory = CLOSED_WON, prob = 100
      const actVal = Math.round(Number(opp.actualOpportunityValue || expVal));
      const cost = Math.round(actVal * ratio);
      const closeDt = opp.wonDate || opp.actualCloseDate || opp.createdAt;
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          amount: expVal,
          expectedOpportunityValue: expVal,
          actualOpportunityValue: actVal,
          bottomLineCost: cost,
          forecastCategory: "CLOSED_WON",
          probability: 100,
          wonDate: closeDt,
          actualCloseDate: closeDt,
          lostReason: null,
        },
      });
    } else if (sName === "Closed Lost") {
      // Closed Lost: forecastCategory = CLOSED_LOST, prob = 0, lostReason set, real past close date
      // actualOpportunityValue may be null (died before proposal) or set (lost after proposal), NEVER 0
      const isPostProposal = opp.actualOpportunityValue && Number(opp.actualOpportunityValue) > 0;
      const actVal = isPostProposal ? Math.round(Number(opp.actualOpportunityValue)) : null;
      const cost = actVal !== null ? Math.round(actVal * ratio) : null;
      const closeDt = opp.actualCloseDate || opp.createdAt;
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          amount: expVal,
          expectedOpportunityValue: expVal,
          actualOpportunityValue: actVal,
          bottomLineCost: cost,
          forecastCategory: "CLOSED_LOST",
          probability: 0,
          wonDate: null,
          actualCloseDate: closeDt,
          lostReason: opp.lostReason || "Competitor offered lower pricing on 3-year term",
        },
      });
    } else if (sName === "Opportunity Dead") {
      // Opportunity Dead: forecastCategory = CLOSED_LOST, prob = 0, lostReason set, actual = null, cost = null
      const closeDt = opp.actualCloseDate || opp.createdAt;
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          amount: expVal,
          expectedOpportunityValue: expVal,
          actualOpportunityValue: null,
          bottomLineCost: null,
          forecastCategory: "CLOSED_LOST",
          probability: 0,
          wonDate: null,
          actualCloseDate: closeDt,
          lostReason: opp.lostReason || "Project shelved due to organizational restructuring",
        },
      });
    }
  }
  console.log("All opportunities reconciled successfully.");

  // 6. Comprehensive Verification Report
  console.log("\n==================== PIPELINE STAGES AUDIT ====================");
  for (const st of oppPipeline.stages) {
    const oppsInStage = await prisma.opportunity.findMany({
      where: {
        tenantId: tenant.id,
        stageId: st.id,
      },
      include: {
        account: true,
        owner: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`\nStage [${st.order}] ${st.name.toUpperCase()} (Prob: ${st.probability}%) — Total: ${oppsInStage.length} opps`);
    for (const opp of oppsInStage.slice(0, 4)) {
      const expVal = opp.expectedOpportunityValue ? Number(opp.expectedOpportunityValue) : null;
      const actVal = opp.actualOpportunityValue ? Number(opp.actualOpportunityValue) : null;
      const cost = opp.bottomLineCost ? Number(opp.bottomLineCost) : null;

      const revDenom = actVal !== null ? actVal : expVal;
      const mv = actVal !== null && cost !== null
        ? actVal - cost
        : expVal !== null && cost !== null
        ? expVal - cost
        : null;
      const mp = mv !== null && revDenom !== null && revDenom > 0
        ? Math.round((mv / revDenom) * 10000) / 100
        : null;

      console.log(`  • ${opp.name.padEnd(65).slice(0, 65)} | Exp: ${String(expVal ?? "null").padStart(8)} | Act: ${String(actVal ?? "null").padStart(8)} | Cost: ${String(cost ?? "null").padStart(8)} | Margin: ${String(mv ?? "—").padStart(8)} (${mp !== null ? mp.toFixed(1) + "%" : "—"}) | ${opp.owner.firstName} ${opp.owner.lastName}`);
    }
  }
  console.log("\n===============================================================");
}

main()
  .catch((e) => {
    console.error("Error during opportunity population:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
