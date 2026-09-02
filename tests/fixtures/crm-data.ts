export interface TestAccountInput {
  name: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
}

export interface TestContactInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle?: string;
  accountId?: string | null;
}

export interface TestOpportunityInput {
  name: string;
  accountId: string;
  contactId?: string | null;
  amount: number;
  expectedDealValue?: number;
  actualDealValue?: number;
  bottomLineCost?: number;
  remarks?: string;
  expectedCloseDate?: string;
  stageId?: string;
  ownerId?: string;
}

export interface TestClosedWonInput {
  poNumber?: string;
  poValue: number;
  remarks?: string;
  filename?: string;
}

export interface TestClosedLostInput {
  lostReason: string;
  remarks?: string;
}

export function generateUniqueId(prefix: string = "test"): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export function createAccountFixture(overrides: Partial<TestAccountInput> = {}): TestAccountInput {
  const uid = generateUniqueId("corp");
  return {
    name: `Acme Corp ${uid}`,
    industry: "Cybersecurity Services",
    email: `contact@${uid.toLowerCase()}.com`,
    phone: "9876543210",
    website: `https://${uid.toLowerCase()}.com`,
    ...overrides,
  };
}

export function createContactFixture(accountId?: string, overrides: Partial<TestContactInput> = {}): TestContactInput {
  const uid = generateUniqueId("user");
  const randomPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  return {
    firstName: "Test",
    lastName: `Contact ${uid}`,
    email: `contact.${uid.toLowerCase()}@example.com`,
    phone: randomPhone,
    jobTitle: "IT Director",
    accountId: accountId || null,
    ...overrides,
  };
}

export function createOpportunityFixture(accountId: string, contactId?: string, overrides: Partial<TestOpportunityInput> = {}): TestOpportunityInput {
  const uid = generateUniqueId("opp");
  const proposalValue = overrides.amount || overrides.actualDealValue || 500000;
  const costIncurred = overrides.bottomLineCost || 300000;
  return {
    name: `SOC Implementation Deal ${uid}`,
    accountId,
    contactId: contactId || null,
    amount: proposalValue,
    actualDealValue: proposalValue,
    expectedDealValue: proposalValue,
    bottomLineCost: costIncurred,
    remarks: "Standard beta test opportunity record",
    expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

export function createClosedWonFixture(overrides: Partial<TestClosedWonInput> = {}): TestClosedWonInput {
  return {
    poNumber: `PO-${Date.now()}`,
    poValue: 750000,
    remarks: "Closed won deal confirmation",
    filename: "Letter_of_Engagement_Confirmation.pdf",
    ...overrides,
  };
}

export function createClosedLostFixture(overrides: Partial<TestClosedLostInput> = {}): TestClosedLostInput {
  return {
    lostReason: "Competitor price undercut by 20%",
    remarks: "Client selected alternative vendor",
    ...overrides,
  };
}

export const API_URL = "http://localhost:4000/api/v1";

