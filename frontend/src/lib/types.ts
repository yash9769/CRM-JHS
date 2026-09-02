export interface Owner {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface Account {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  annualRevenue?: string | null;
  accountType: "PROSPECT" | "CUSTOMER" | "PARTNER" | "FORMER_CUSTOMER";
  billingAddress?: string | null;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  owner?: Owner | null;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { contacts: number; opportunities: number };
  contacts?: Contact[];
  opportunities?: Opportunity[];
  quotes?: any[];
  activities?: Activity[];
  notes?: Note[];
}

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "NURTURING" | "UNQUALIFIED" | "CONVERTED";

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  source?: string | null;
  status: LeadStatus;
  score: number;
  notes?: string | null;
  archived: boolean;
  ownerId?: string | null;
  owner?: Owner | null;
  convertedAt?: string | null;
  convertedAccountId?: string | null;
  convertedContactId?: string | null;
  convertedOpportunityId?: string | null;
  convertedAccount?: { id: string; name: string } | null;
  convertedContact?: { id: string; firstName: string; lastName: string } | null;
  convertedOpportunity?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
  notesList?: Note[];
}

export interface DuplicateLeadCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  status: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  lifecycleStage: string;
  leadSource?: string | null;
  ownerId?: string | null;
  owner?: Owner | null;
  accountId?: string | null;
  account?: Account | null;
  linkedinUrl?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
  opportunityContacts?: { opportunity: Opportunity }[];
  primaryOpportunities?: Opportunity[];
  activities?: Activity[];
  notes?: Note[];
}

export const CANONICAL_STAGES = [
  "Prospect",
  "Lead",
  "Marketing Qualified Lead",
  "Scope Discussion",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
  "Opportunity Dead",
] as const;

export type CanonicalStageName = (typeof CANONICAL_STAGES)[number];

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  probability: number;
  isClosed: boolean;
  isWon: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  type: "OPPORTUNITY";
  isDefault: boolean;
  stages: PipelineStage[];
}

export interface OpportunityAttachment {
  id: string;
  opportunityId: string;
  stageApprovalId?: string | null;
  originalFilename: string;
  storageKey?: string;
  mimeType?: string;
  size: number;
  uploadedById: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface StageApproval {
  id: string;
  tenantId: string;
  opportunityId: string;
  requestedById: string;
  requestedBy?: { id: string; firstName: string; lastName: string; email?: string };
  approverId?: string | null;
  approver?: { id: string; firstName: string; lastName: string };
  reviewedById?: string | null;
  reviewedBy?: { id: string; firstName: string; lastName: string };
  fromStageId: string;
  fromStage?: PipelineStage;
  toStageId: string;
  toStage?: PipelineStage;
  status: "PENDING" | "APPROVED" | "DISAPPROVED" | "CANCELLED";
  comments?: string | null;
  requesterComment?: string | null;
  approverComment?: string | null;
  loeValue?: string | null;
  loeUnit?: string | null;
  poNumber?: string | null;
  poValue?: number | string | null;
  attachments?: OpportunityAttachment[];
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  opportunity?: {
    id: string;
    name: string;
    amount?: string | number;
    expectedCloseDate?: string | null;
    account?: { id: string; name: string };
    contact?: { id: string; firstName: string; lastName: string };
    owner?: { id: string; firstName: string; lastName: string };
  };
}

export interface Opportunity {
  id: string;
  name: string;
  accountId: string;
  account?: Account;
  contactId?: string | null;
  contact?: Contact | null;
  amount: string;
  expectedDealValue?: string | number | null;
  actualDealValue?: string | number | null;
  bottomLineCost?: string | number | null;
  expectedMargin?: string | number | null;
  grossMargin?: string | number | null;
  marginLoss?: string | number | null;
  topLineRevenue?: string | number | null;
  hasMissingActualValue?: boolean;
  pipelineId: string;
  pipeline?: Pipeline;
  stageId: string;
  stage: PipelineStage;
  probability: number;
  expectedCloseDate?: string | null;
  actualCloseDate?: string | null;
  wonDate?: string | null;
  lostReason?: string | null;
  loeValue?: string | null;
  loeUnit?: string | null;
  poNumber?: string | null;
  poValue?: number | string | null;
  dealType?: string | null;
  forecastCategory?: string;
  ownerId: string;
  owner?: Owner;
  opportunityType: "NEW_BUSINESS" | "EXPANSION" | "RENEWAL";
  leadSource?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: { contact: Contact }[];
  lineItems?: LineItem[];
  quotes?: any[];
  activities?: Activity[];
  notes?: Note[];
  stageApprovals?: StageApproval[];
  attachments?: OpportunityAttachment[];
}

export interface DashboardMetrics {
  kpis: {
    totalPipeline: number;
    weightedPipeline: number;
    openOpportunities: number;
    closedWonRevenue: number;
    winRate: number;
    avgOpportunitySize: number;
    oppsClosingThisMonth: number;
    totalExpectedMargin?: number;
    totalGrossMargin?: number;
    totalMarginLoss?: number;
    totalBottomLineCost?: number;
  };
  charts: {
    pipelineByStage: { stageName: string; count: number; amount: number }[];
    revenueByMonth: { month: string; revenue: number }[];
    oppsByOwner: { owner: string; count: number; amount: number }[];
  };
}

export interface Service {
  id: string;
  tenantId?: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  serviceId: string;
  service?: Service | null;
  name: string;
  sku?: string | null;
  category?: string | null;
  description?: string | null;
  unitPrice: string;
  currency: string;
  active: boolean;
}

export interface LineItem {
  id: string;
  productId: string;
  product?: Product;
  opportunityId?: string | null;
  quoteId?: string | null;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  taxPct: string;
  total: string;
}

export interface Activity {
  id: string;
  type: "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE" | "FOLLOW_UP" | "DEMO" | "PROPOSAL" | "OTHER";
  subject: string;
  body?: string | null;
  ownerId: string;
  owner?: Owner;
  dueDate?: string | null;
  completedDate?: string | null;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  objectType: string;
  createdAt: string;
}

export interface Note {
  id: string;
  body: string;
  authorId: string;
  author?: Owner;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
