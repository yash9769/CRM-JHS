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
  "Opportunity",
  "Scope Discussion",
  "Proposal Sent",
  "Negotiation",
  "Proposal Won",
  "Proposal Lost",
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

export interface Opportunity {
  id: string;
  name: string;
  accountId: string;
  account?: Account;
  contactId?: string | null;
  contact?: Contact | null;
  amount: string;
  pipelineId: string;
  pipeline?: Pipeline;
  stageId: string;
  stage: PipelineStage;
  probability: number;
  expectedCloseDate?: string | null;
  actualCloseDate?: string | null;
  wonDate?: string | null;
  lostReason?: string | null;
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
  stageHistory?: any[];
}

export interface Product {
  id: string;
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
