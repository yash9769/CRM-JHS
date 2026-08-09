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
  _count?: { contacts: number; opportunities: number; deals: number };
  contacts?: Contact[];
  opportunities?: Opportunity[];
  deals?: Deal[];
  quotes?: any[];
  activities?: Activity[];
  notes?: Note[];
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
  dealContacts?: { deal: Deal }[];
  activities?: Activity[];
  notes?: Note[];
}

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
  type: "OPPORTUNITY" | "DEAL";
  isDefault: boolean;
  stages: PipelineStage[];
}

export interface Opportunity {
  id: string;
  name: string;
  accountId: string;
  account?: Account;
  amount: string;
  pipelineId: string;
  pipeline?: Pipeline;
  stageId: string;
  stage?: PipelineStage;
  probability: number;
  expectedCloseDate?: string | null;
  ownerId: string;
  owner?: Owner;
  opportunityType: "NEW_BUSINESS" | "EXPANSION" | "RENEWAL";
  leadSource?: string | null;
  description?: string | null;
  isConverted: boolean;
  convertedDealId?: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: { contact: Contact }[];
  activities?: Activity[];
  notes?: Note[];
  stageHistory?: any[];
}

export interface Deal {
  id: string;
  name: string;
  accountId: string;
  account?: Account;
  opportunityId?: string | null;
  opportunity?: Opportunity | null;
  amount: string;
  pipelineId: string;
  pipeline?: Pipeline;
  stageId: string;
  stage?: PipelineStage;
  closeDate?: string | null;
  ownerId: string;
  owner?: Owner;
  probability: number;
  dealType?: string | null;
  forecastCategory: string;
  description?: string | null;
  wonDate?: string | null;
  lostReason?: string | null;
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
  dealId?: string | null;
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
