# FUNCTIONS.md — Codebase Symbol Registry

A comprehensive registry of every function, class, component, and API route across the CRM codebase.

---

## 1. Backend Core & Plugins

| Name | File Path | One-Line Purpose | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `buildApp` | `backend/src/app.ts` | Builds and configures Fastify instance, registers plugins, routes, and central error handlers | `opts?: object` | `Promise<FastifyInstance>` |
| `registerAuth` | `backend/src/plugins/auth.ts` | Configures JWT plugin, decorates `authenticate` with dynamic DB tenant resolution | `app: FastifyInstance` | `Promise<void>` |
| `authenticate` | `backend/src/plugins/auth.ts` | Pre-handler hook verifying JWT token and attaching fresh user tenant & role to `req.authUser` | `req: FastifyRequest, reply: FastifyReply` | `Promise<void>` |

---

## 2. Backend Libraries & Helpers

| Name | File Path | One-Line Purpose | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `logAudit` | `backend/src/lib/audit.ts` | Records immutable audit log entries for record mutations | `params: { tenantId, userId?, objectType, recordId, action, oldValues?, newValues? }` | `Promise<void>` |
| `createAssociation` | `backend/src/lib/audit.ts` | Creates generic bidirectional entity relationships | `params: { tenantId, fromObjectType, fromRecordId, toObjectType, toRecordId, label? }` | `Promise<void>` |
| `notify` | `backend/src/lib/audit.ts` | Dispatches in-app notification to a user | `params: { tenantId, userId, message, link? }` | `Promise<void>` |
| `toCsv` | `backend/src/lib/csv.ts` | Converts JSON objects array into RFC-compliant CSV string | `rows: Record<string, any>[], columns: { key: string; label: string }[]` | `string` |
| `generateQuotePdf` | `backend/src/lib/quotePdf.ts` | Renders a styled, professional sales quote PDF in memory | `input: QuotePdfInput` | `Promise<Buffer>` |
| `prisma` | `backend/src/lib/prisma.ts` | Global Prisma ORM client singleton instance | None | `PrismaClient` |

---

## 3. Backend API Routes

### 🔐 Authentication & Users (`/api/v1/auth`, `/api/v1/users`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/v1/auth/register` | `backend/src/routes/auth.ts` | Registers new tenant & admin user, seeds default pipelines | `{ companyName, firstName, lastName, email, password }` | `{ token, user, tenant }` (201) |
| `POST /api/v1/auth/login` | `backend/src/routes/auth.ts` | Authenticates user credentials via Argon2 | `{ email, password }` | `{ token, user }` (200) |
| `GET /api/v1/auth/me` | `backend/src/routes/auth.ts` | Retrieves current authenticated session user and tenant | Bearer Auth Header | `{ user, tenant }` |
| `GET /api/v1/users` | `backend/src/routes/users.ts` | Lists all active workspace users | Bearer Auth Header | `{ data: User[] }` |
| `POST /api/v1/users/invite` | `backend/src/routes/users.ts` | Invites/creates a new team member with role | `{ email, firstName, lastName, role, password? }` | `{ data: User }` |
| `PATCH /api/v1/users/:id` | `backend/src/routes/users.ts` | Updates a team member's role or status | `{ firstName?, lastName?, role?, active? }` | `{ data: User }` |
| `DELETE /api/v1/users/:id` | `backend/src/routes/users.ts` | Deactivates or removes a workspace member | None | `{ success: true }` |
| `GET /api/v1/users/stats` | `backend/src/routes/users.ts` | Returns workspace user count breakdown by role | None | `{ total, byRole: Record<string, number> }` |

### 🏢 Accounts (`/api/v1/accounts`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/accounts` | `backend/src/routes/accounts.ts` | Lists accounts with filtering, search, pagination | `?page&pageSize&search&industry&accountType&ownerId&archived` | `{ data: Account[], pagination }` |
| `POST /api/v1/accounts/check-duplicate` | `backend/src/routes/accounts.ts` | Checks domain/name similarity for duplicate warnings | `{ name, domain? }` | `{ duplicate: boolean, existing?: Account }` |
| `GET /api/v1/accounts/export` | `backend/src/routes/accounts.ts` | Exports filtered accounts as CSV download | `?search&industry&accountType` | `text/csv` |
| `POST /api/v1/accounts` | `backend/src/routes/accounts.ts` | Creates a new customer account | Account payload (name, domain, rev, ownerId, etc.) | `Account` (201) |
| `POST /api/v1/accounts/import` | `backend/src/routes/accounts.ts` | Bulk imports accounts with mapping, validation, and duplicate detection | `{ rows, mapping, commit, duplicateStrategy, rowDecisions }` | `{ summary, results }` |
| `GET /api/v1/accounts/:id` | `backend/src/routes/accounts.ts` | Fetches account detail with nested contacts, deals, quotes | None | `Account` |
| `PATCH /api/v1/accounts/:id` | `backend/src/routes/accounts.ts` | Updates account fields and properties | Partial account payload | `Account` |
| `DELETE /api/v1/accounts/:id` | `backend/src/routes/accounts.ts` | Soft or hard deletes an account | None | `{ success: true }` |
| `GET /api/v1/accounts/:id/impact` | `backend/src/routes/accounts.ts` | Assesses cascade impact before deletion | None | `{ contactsCount, oppsCount, dealsCount }` |
| `POST /api/v1/accounts/:id/archive` | `backend/src/routes/accounts.ts` | Toggles account archive state to true | None | `{ success: true }` |
| `POST /api/v1/accounts/:id/unarchive` | `backend/src/routes/accounts.ts` | Restores an archived account | None | `{ success: true }` |

### 👥 Contacts (`/api/v1/contacts`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/contacts` | `backend/src/routes/contacts.ts` | Lists contacts with filtering and pagination | `?page&pageSize&search&accountId&lifecycleStage` | `{ data: Contact[], pagination }` |
| `POST /api/v1/contacts/check-duplicate` | `backend/src/routes/contacts.ts` | Checks for existing email conflicts | `{ email }` | `{ duplicate: boolean, existing?: Contact }` |
| `GET /api/v1/contacts/export` | `backend/src/routes/contacts.ts` | Exports filtered contacts to CSV | `?search&accountId&lifecycleStage` | `text/csv` |
| `POST /api/v1/contacts/import` | `backend/src/routes/contacts.ts` | Bulk imports contacts with mapping, account auto-creation, and duplicate check | `{ rows, mapping, commit, createMissingAccount, duplicateStrategy, rowDecisions }` | `{ summary, results }` |
| `POST /api/v1/contacts` | `backend/src/routes/contacts.ts` | Creates a new contact record | Contact payload (firstName, lastName, email, etc.) | `Contact` (201) |
| `GET /api/v1/contacts/:id` | `backend/src/routes/contacts.ts` | Gets contact detail, account link, activities | None | `Contact` |
| `PATCH /api/v1/contacts/:id` | `backend/src/routes/contacts.ts` | Updates contact details | Partial contact payload | `Contact` |
| `DELETE /api/v1/contacts/:id` | `backend/src/routes/contacts.ts` | Deletes a contact record | None | `{ success: true }` |
| `POST /api/v1/contacts/:id/archive` | `backend/src/routes/contacts.ts` | Archives a contact | None | `{ success: true }` |

### 🎯 Leads (`/api/v1/leads`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/leads` | `backend/src/routes/leads.ts` | Lists leads with scoring & status filtering | `?page&pageSize&search&status&minScore&ownerId` | `{ data: Lead[], pagination }` |
| `GET /api/v1/leads/export` | `backend/src/routes/leads.ts` | Exports filtered leads to CSV | Query filters | `text/csv` |
| `POST /api/v1/leads/import` | `backend/src/routes/leads.ts` | Bulk imports leads from parsed CSV rows with duplicate actions | `{ rows, mapping, commit, duplicateStrategy, rowDecisions }` | `{ summary, results }` |
| `POST /api/v1/leads/check-duplicate` | `backend/src/routes/leads.ts` | Checks email duplicate status | `{ email }` | `{ duplicate: boolean }` |
| `POST /api/v1/leads` | `backend/src/routes/leads.ts` | Creates a new prospect lead | Lead payload | `Lead` (201) |
| `GET /api/v1/leads/:id` | `backend/src/routes/leads.ts` | Gets single lead detail with timeline | None | `Lead` |
| `PATCH /api/v1/leads/:id` | `backend/src/routes/leads.ts` | Updates lead properties or status | Partial lead payload | `Lead` |
| `POST /api/v1/leads/:id/convert` | `backend/src/routes/leads.ts` | Converts lead into Account, Contact, and Opportunity | `{ createAccount, createContact, createOpportunity, oppName?, amount? }` | `{ accountId, contactId, opportunityId }` |
| `POST /api/v1/leads/:id/archive` | `backend/src/routes/leads.ts` | Archives a lead | None | `{ success: true }` |
| `POST /api/v1/leads/bulk` | `backend/src/routes/leads.ts` | Performs bulk status updates or deletions | `{ ids: string[], action: "status" | "delete" | "archive", payload?: any }` | `{ updatedCount }` |
| `DELETE /api/v1/leads/:id` | `backend/src/routes/leads.ts` | Deletes a lead | None | `{ success: true }` |

### 📈 Opportunities & Deals (`/api/v1/opportunities`, `/api/v1/deals`, `/api/v1/pipelines`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/pipelines` | `backend/src/routes/pipelines.ts` | Retrieves opportunity & deal pipelines with canonical stages | `?type` | `Pipeline[]` |
| `GET /api/v1/opportunities` | `backend/src/routes/opportunities.ts` | Lists opportunities with stage, deal stage, contact, and account owner | `?page&pageSize&pipelineId&stageId&search` | `{ data: Opportunity[], pagination }` |
| `GET /api/v1/opportunities/export` | `backend/src/routes/opportunities.ts` | Exports filtered opportunities to CSV with 11 core business fields | `?search&stageId&pipelineId&ownerId` | `text/csv` |
| `POST /api/v1/opportunities/import` | `backend/src/routes/opportunities.ts` | Bulk imports opportunities with stage & date validation, auto account/contact creation | `{ rows, mapping, commit, createMissingAccount, createMissingContact, duplicateStrategy }` | `{ summary, results }` |
| `POST /api/v1/opportunities` | `backend/src/routes/opportunities.ts` | Creates opportunity with inline account/contact creation, deal value, stage, close date validation | Opportunity payload (name, accountId, contactId, amount, stageId, dealStageId, ownerId, createdAt, expectedCloseDate, remarks) | `Opportunity` (201) |
| `GET /api/v1/opportunities/:id` | `backend/src/routes/opportunities.ts` | Gets opportunity with account owner, primary contact, stage history, and activities | None | `Opportunity` |
| `PATCH /api/v1/opportunities/:id` | `backend/src/routes/opportunities.ts` | Updates opportunity fields, stage, contact, or close date | Partial opp payload | `Opportunity` |
| `POST /api/v1/opportunities/:id/convert`| `backend/src/routes/opportunities.ts` | Converts opportunity to deal preserving relationships and financials | `{ dealPipelineId?, dealStageId?, closeDate? }` | `{ deal: Deal }` |
| `POST /api/v1/opportunities/:id/archive`| `backend/src/routes/opportunities.ts` | Archives an opportunity | None | `{ success: true }` |
| `DELETE /api/v1/opportunities/:id` | `backend/src/routes/opportunities.ts` | Deletes an opportunity | None | `{ success: true }` |
| `GET /api/v1/deals` | `backend/src/routes/deals.ts` | Lists deals with line items, accounts, primary contact, stages | `?page&pageSize&stageId&ownerId&search&won` | `{ data: Deal[], pagination }` |
| `GET /api/v1/deals/export` | `backend/src/routes/deals.ts` | Exports filtered deals to CSV | `?search&stageId&pipelineId&ownerId&won` | `text/csv` |
| `POST /api/v1/deals/import` | `backend/src/routes/deals.ts` | Bulk imports deals with relationship resolution and stage validation | `{ rows, mapping, commit, createMissingAccount, createMissingContact, duplicateStrategy }` | `{ summary, results }` |
| `POST /api/v1/deals` | `backend/src/routes/deals.ts` | Creates a deal linked to account, contact, and pipeline stage | Deal payload | `Deal` (201) |
| `GET /api/v1/deals/:id` | `backend/src/routes/deals.ts` | Gets deal detail, primary contact, line items, stage history | None | `Deal` |
| `PATCH /api/v1/deals/:id` | `backend/src/routes/deals.ts` | Updates deal (handles Won/Lost rules, contact, & dates) | Partial deal payload | `Deal` |
| `DELETE /api/v1/deals/:id` | `backend/src/routes/deals.ts` | Deletes a deal record | None | `{ success: true }` |
| `POST /api/v1/deals/:id/archive` | `backend/src/routes/deals.ts` | Archives a deal | None | `{ success: true }` |
| `POST /api/v1/deals/:id/line-items` | `backend/src/routes/deals.ts` | Attaches a product line item to deal | `{ productId, quantity, unitPrice, discountPct, taxPct }` | `LineItem` |
| `DELETE /api/v1/deals/:dealId/line-items/:lineItemId` | `backend/src/routes/deals.ts` | Removes line item from deal and updates totals | None | `{ success: true }` |

### 📄 Quotes & Activities (`/api/v1/quotes`, `/api/v1/activities`, `/api/v1/products`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/products` | `backend/src/routes/products.ts` | Lists product catalog items | `?search&active` | `Product[]` |
| `POST /api/v1/products` | `backend/src/routes/products.ts` | Creates new catalog product | Product payload | `Product` |
| `GET /api/v1/quotes` | `backend/src/routes/quotes.ts` | Lists quotes with deal, account, line items | `?dealId&accountId&status&page&pageSize` | `{ data: Quote[], pagination }` |
| `GET /api/v1/quotes/export` | `backend/src/routes/quotes.ts` | Exports filtered quotes to CSV | `?status&dealId&accountId&search` | `text/csv` |
| `GET /api/v1/activities` | `backend/src/routes/activities.ts` | Lists activities and tasks across entities | `?accountId&contactId&dealId&leadId&type&status` | `{ data: Activity[] }` |
| `GET /api/v1/activities/export` | `backend/src/routes/activities.ts` | Exports filtered activities/tasks to CSV | `?type&status&ownerId&search` | `text/csv` |
| `PATCH /api/v1/products/:id` | `backend/src/routes/products.ts` | Updates product details/pricing | Partial product payload | `Product` |
| `GET /api/v1/quotes` | `backend/src/routes/quotes.ts` | Lists sales quotes | `?search&status&dealId` | `Quote[]` |
| `GET /api/v1/quotes/:id` | `backend/src/routes/quotes.ts` | Gets quote detail with line items | None | `Quote` |
| `POST /api/v1/quotes` | `backend/src/routes/quotes.ts` | Creates quote from deal | Quote payload with line items | `Quote` (201) |
| `PATCH /api/v1/quotes/:id` | `backend/src/routes/quotes.ts` | Updates quote status/terms | `{ status?, expirationDate?, discountPct?, taxPct? }` | `Quote` |
| `DELETE /api/v1/quotes/:id` | `backend/src/routes/quotes.ts` | Deletes draft quote | None | `{ success: true }` |
| `GET /api/v1/quotes/:id/pdf` | `backend/src/routes/quotes.ts` | Generates and downloads PDF quote | None | `application/pdf` buffer |
| `POST /api/v1/quotes/:id/duplicate` | `backend/src/routes/quotes.ts` | Clones existing quote as new draft | None | `Quote` (201) |

### ⚡ Sequences & Tasks (`/api/v1/sequences`, `/api/v1/activities`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/sequences` | `backend/src/routes/sequences.ts` | Lists outreach sequences with step counts | None | `Sequence[]` |
| `GET /api/v1/sequences/:id` | `backend/src/routes/sequences.ts` | Gets sequence steps & enrollments | None | `Sequence` |
| `POST /api/v1/sequences` | `backend/src/routes/sequences.ts` | Creates new outreach sequence | `{ name, description?, steps? }` | `Sequence` |
| `PATCH /api/v1/sequences/:id` | `backend/src/routes/sequences.ts` | Updates sequence status or info | Partial sequence payload | `Sequence` |
| `DELETE /api/v1/sequences/:id` | `backend/src/routes/sequences.ts` | Deletes a sequence | None | `{ success: true }` |
| `POST /api/v1/sequences/:id/steps` | `backend/src/routes/sequences.ts` | Appends a step to sequence | `{ type, config, order }` | `SequenceStep` |
| `POST /api/v1/sequences/:id/enroll` | `backend/src/routes/sequences.ts` | Enrolls a contact into sequence | `{ contactId }` | `SequenceEnrollment` |
| `GET /api/v1/sequences/:id/enrollments`| `backend/src/routes/sequences.ts` | Lists all enrolled contacts in sequence | None | `SequenceEnrollment[]` |
| `DELETE /api/v1/sequences/:id/enrollments/:enrollmentId` | `backend/src/routes/sequences.ts` | Unenrolls contact | None | `{ success: true }` |
| `GET /api/v1/activities` | `backend/src/routes/activities.ts` | Lists tasks/calls/meetings for timeline/tasks | `?objectType&recordId&type&status&ownerId` | `Activity[]` |
| `POST /api/v1/activities` | `backend/src/routes/activities.ts` | Logs call, meeting, or task | Activity payload | `Activity` (201) |
| `PATCH /api/v1/activities/:id` | `backend/src/routes/activities.ts` | Updates task status or due date | Partial activity payload | `Activity` |
| `POST /api/v1/notes` | `backend/src/routes/activities.ts` | Adds note to record timeline | `{ body, objectType, recordId }` | `Note` (201) |
| `PATCH /api/v1/notes/:id` | `backend/src/routes/activities.ts` | Edits existing note | `{ body }` | `Note` |
| `DELETE /api/v1/notes/:id` | `backend/src/routes/activities.ts` | Removes a note | None | `{ success: true }` |

### 📊 Dashboard, Reports & Analytics (`/api/v1/dashboard`, `/api/v1/reports`, `/api/v1/forecast`)
| Method & Endpoint | File Path | Purpose | Request Body / Query | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/dashboard` | `backend/src/routes/dashboard.ts` | Aggregates pipeline KPIs, revenue trend, and owner stats | None | `{ kpis, charts }` |
| `GET /api/v1/dashboard/action-center`| `backend/src/routes/dashboard.ts` | Returns action items: overdue tasks, closing deals, risk | None | `{ todaysWork, recentLeads, upcomingTasks, dealsAtRisk }` |
| `GET /api/v1/forecast` | `backend/src/routes/forecasting.ts` | Computes rep attainment vs monthly target | `?period` | `{ reps, totals }` |
| `POST /api/v1/forecast/targets` | `backend/src/routes/forecasting.ts` | Sets monthly quota target for a sales rep | `{ ownerId?, period, targetAmount }` | `ForecastTarget` |
| `GET /api/v1/forecast/trend` | `backend/src/routes/forecasting.ts` | Calculates 12-month rolling attainment trend | None | `ForecastTrendPoint[]` |
| `GET /api/v1/reports/pipeline-health`| `backend/src/routes/reports.ts` | Stage conversion volume and probability breakdown | None | `{ stages: ReportStage[] }` |
| `GET /api/v1/reports/owner-performance`| `backend/src/routes/reports.ts` | Sales rep leaderboard (deals won, win rate, avg size) | None | `{ reps: RepPerformance[] }` |
| `GET /api/v1/reports/win-loss` | `backend/src/routes/reports.ts` | Win/loss ratio and lost reasons breakdown | None | `{ winRate, reasons: LostReason[] }` |
| `GET /api/v1/reports/conversion-funnel`| `backend/src/routes/reports.ts` | Funnel metrics (Leads → Opps → Deals → Won) | None | `{ funnel: FunnelStep[] }` |
| `GET /api/v1/search` | `backend/src/routes/search.ts` | Cross-entity global search across all records | `?q` | `{ accounts, contacts, opportunities, deals, leads }` |
| `GET /api/v1/notifications` | `backend/src/routes/notifications.ts` | Fetches notification feed for user | `?unreadOnly` | `Notification[]` |
| `PATCH /api/v1/notifications/:id/read`| `backend/src/routes/notifications.ts` | Marks single notification as read | None | `Notification` |
| `POST /api/v1/notifications/read-all`| `backend/src/routes/notifications.ts` | Marks all notifications read for user | None | `{ success: true }` |
| `GET /api/v1/audit-log` | `backend/src/routes/auditHistory.ts` | Fetches record audit history | `?objectType&recordId` | `AuditLog[]` |
| `GET /api/v1/saved-views` | `backend/src/routes/savedViews.ts` | Lists user's saved filter views | `?objectType` | `SavedView[]` |
| `POST /api/v1/saved-views` | `backend/src/routes/savedViews.ts` | Saves custom table filter view | `{ objectType, name, filters, sortBy?, sortDir? }` | `SavedView` |
| `DELETE /api/v1/saved-views/:id` | `backend/src/routes/savedViews.ts` | Deletes saved view | None | `{ success: true }` |

---

## 4. Frontend Hooks & Utilities

| Name | File Path | One-Line Purpose | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `useAuth` | `frontend/src/hooks/useAuth.tsx` | Access current user, tenant, login, register, logout | None | `AuthContextValue` |
| `AuthProvider` | `frontend/src/hooks/useAuth.tsx` | React Context Provider managing auth session lifecycle | `{ children: ReactNode }` | `JSX.Element` |
| `api` | `frontend/src/lib/api.ts` | Configured Axios HTTP client with JWT interceptor & 401 redirect | None | `AxiosInstance` |
| `formatCurrency` | `frontend/src/lib/format.ts` | Formats numbers as INR (`₹X,XX,XXX`) | `value: number \| string, currency?: string` | `string` |
| `formatDate` | `frontend/src/lib/format.ts` | Formats dates as `MMM d, yyyy` | `value?: string \| Date \| null` | `string` |
| `formatDateTime` | `frontend/src/lib/format.ts` | Formats date and time string | `value?: string \| Date \| null` | `string` |
| `initials` | `frontend/src/lib/format.ts` | Extracts two-letter uppercase name initials | `first?: string, last?: string` | `string` |
| `relativeTime` | `frontend/src/lib/format.ts` | Returns human-friendly relative time (e.g. `2h ago`) | `value: string \| Date` | `string` |
| `fetchAccountOptions` | `frontend/src/lib/pickers.ts` | Autocomplete search for account selector dropdowns | `search: string` | `Promise<RelationshipOption[]>` |
| `fetchContactOptions` | `frontend/src/lib/pickers.ts` | Autocomplete search for contact dropdowns | `search: string, accountId?: string` | `Promise<RelationshipOption[]>` |
| `fetchOpportunityOptions` | `frontend/src/lib/pickers.ts` | Autocomplete search for opportunity selector | `search: string, accountId?: string` | `Promise<RelationshipOption[]>` |
| `fetchOwnerOptions` | `frontend/src/lib/pickers.ts` | Cached search for workspace team members | `search: string` | `Promise<RelationshipOption[]>` |

---

## 5. Frontend UI Components & Modals

| Component Name | File Path | One-Line Purpose | Key Props |
| :--- | :--- | :--- | :--- |
| `AppShell` | `frontend/src/components/AppShell.tsx` | Master CRM application layout (Sidebar, Navbar, Global Search, Notifications) | None (Outlet layout) |
| `PageHeader` | `frontend/src/components/ui.tsx` | Standard header with title, subtitle, and action buttons | `title, subtitle?, actions?, breadcrumb?` |
| `Card` | `frontend/src/components/ui.tsx` | Surface card container with consistent border & background | `children, className?` |
| `Button` | `frontend/src/components/ui.tsx` | Standard styled button (primary, secondary, danger, ghost) | `variant, tone, size, loading, icon, children` |
| `Badge` | `frontend/src/components/ui.tsx` | Pill status badge | `tone: "neutral" \| "green" \| "amber" \| "rose"` |
| `StageBadge` | `frontend/src/components/ui.tsx` | Pipeline stage badge indicator | `stage?: { name, isClosed, isWon }` |
| `EmptyState` | `frontend/src/components/ui.tsx` | Empty table/list fallback message with CTA | `title, subtitle?, action?` |
| `Modal` | `frontend/src/components/ui.tsx` | Accessible backdrop dialog wrapper | `title, onClose, width, children` |
| `Field` | `frontend/src/components/ui.tsx` | Form input wrapper with label and required asterisk | `label, required?, children` |
| `KanbanBoard` | `frontend/src/components/Kanban.tsx` | Drag-and-drop Kanban board with column cards, stage stats, and terminal stage confirmation | `stages, items, basePath, onMove` |
| `Timeline` | `frontend/src/components/Timeline.tsx` | Shared activity & note feed for record detail views | `activities, notes, assoc, queryKeysToInvalidate` |
| `HistoryPanel` | `frontend/src/components/HistoryPanel.tsx` | Audit trail history panel showing changed fields | `objectType: string, recordId: string` |
| `RelationshipSelector`| `frontend/src/components/RelationshipSelector.tsx` | Searchable asynchronous selector dropdown with inline create | `value, valueLabel?, onChange, fetchOptions, placeholder, onCreateNew?, createLabel?` |
| `SavedViewsBar` | `frontend/src/components/SavedViewsBar.tsx` | Tab bar for switching and saving table filter views | `objectType, activeViewId, onViewChange, onSaveCurrentView` |
| `BulkActionBar` | `frontend/src/components/BulkActionBar.tsx` | Floating footer bar for batch operations on selected rows | `count, onClear, children` |
| `QuickCreateButton` | `frontend/src/components/QuickCreate.tsx` | Global top-bar `+ Create` dropdown menu | None |
| `CsvImportModal` | `frontend/src/components/CsvImportModal.tsx` | Universal 5-step CSV import wizard (Upload, Auto-Mapping, Validation, Duplicate Resolution, Preview/Commit, Error Download) | `entity: "accounts" \| "contacts" \| "leads" \| "opportunities" \| "deals", onClose: () => void` |
| `ImportLeadsModal` | `frontend/src/components/ImportLeadsModal.tsx` | CSV upload & mapping wizard for importing leads | `onClose: () => void` |
| `downloadCsvExport` | `frontend/src/lib/exportCsv.ts` | Triggers backend CSV export download respecting active search and filters | `endpoint: string, params?: Record<string, any>, fallbackFilename?: string` |
| `NewAccountModal` | `frontend/src/components/CreateModals.tsx` | Modal form for creating customer companies | `onClose, onCreated?, initialName?` |
| `NewContactModal` | `frontend/src/components/CreateModals.tsx` | Modal form for creating contacts linked to accounts | `onClose, onCreated?, accountId?, accountName?` |
| `NewOpportunityModal`| `frontend/src/components/CreateModals.tsx` | Modal form for creating pipeline opportunities (11 required fields, inline account/contact creation, deal value, stage sync, close date validation) | `onClose, onCreated?, accountId?, accountName?, contactId?, contactName?, initialName?, initialAmount?` |
| `NewDealModal` | `frontend/src/components/CreateModals.tsx` | Modal form for creating revenue deals with pipeline stages, account, and contact linking | `onClose, onCreated?, accountId?, accountName?, opportunityId?, opportunityName?, contactId?, contactName?, initialAmount?, initialRemarks?` |
| `NewLeadModal` | `frontend/src/components/CreateModals.tsx` | Modal form for adding inbound/outbound leads with pre-populated company & contact info | `onClose, onCreated?, initialCompanyName?, initialFirstName?, initialLastName?, initialEmail?, initialPhone?` |
| `NewTaskModal` | `frontend/src/components/CreateModals.tsx` | Modal form for scheduling tasks with due dates | `onClose, onCreated?, context?` |
| `LogActivityModal` | `frontend/src/components/CreateModals.tsx` | Modal for logging completed calls and meetings | `onClose, onCreated?, context?` |
| `EditAccountModal` | `frontend/src/components/EditModals.tsx` | Modal form for editing existing account details | `account: Account, onClose: () => void` |
| `EditContactModal` | `frontend/src/components/EditModals.tsx` | Modal form for editing existing contact details | `contact: Contact, onClose: () => void` |
| `EditOpportunityModal`| `frontend/src/components/EditModals.tsx` | Modal form for modifying all opportunity fields (account owner, account, contact, amount, stages, dates, remarks) | `opp: Opportunity, onClose: () => void` |
| `EditDealModal` | `frontend/src/components/EditModals.tsx` | Modal form for modifying deal properties | `deal: Deal, onClose: () => void` |
| `EditLeadModal` | `frontend/src/components/EditModals.tsx` | Modal form for updating lead details | `lead: Lead, onClose: () => void` |
| `ArchiveConfirmModal`| `frontend/src/components/EditModals.tsx` | Confirmation dialog for archiving/deleting entities with impact summary | `title, impactUrl?, onConfirm, onClose, isPending?` |

---

## 6. Frontend Pages

| Page Component | File Path | Route Path | Purpose |
| :--- | :--- | :--- | :--- |
| `DashboardPage` | `frontend/src/pages/DashboardPage.tsx` | `/` | Executive KPI dashboard, revenue graphs, action center |
| `AccountsPage` | `frontend/src/pages/AccountsPage.tsx` | `/accounts` | Customer companies data table, search, filters, CSV export |
| `AccountDetailPage`| `frontend/src/pages/AccountDetailPage.tsx` | `/accounts/:id` | Account 360 view: contacts, open deals, timeline, hierarchy |
| `ContactsPage` | `frontend/src/pages/ContactsPage.tsx` | `/contacts` | Contacts data table with lifecycle stage filters |
| `ContactDetailPage`| `frontend/src/pages/ContactDetailPage.tsx` | `/contacts/:id` | Contact profile view, account association, communications |
| `LeadsPage` | `frontend/src/pages/LeadsPage.tsx` | `/leads` | Prospect lead list with score badges and status grouping |
| `LeadDetailPage` | `frontend/src/pages/LeadDetailPage.tsx` | `/leads/:id` | Lead details, activity feed, and 1-click conversion wizard |
| `PipelinePage` | `frontend/src/pages/PipelinePage.tsx` | `/pipeline` | Drag-and-drop opportunity Kanban pipeline |
| `OpportunitiesPage`| `frontend/src/pages/OpportunitiesPage.tsx` | `/opportunities` | Opportunities table view with stage filtering |
| `OpportunityDetailPage`| `frontend/src/pages/OpportunityDetailPage.tsx` | `/opportunities/:id`| Opportunity breakdown, stage change stepper, deal conversion |
| `DealsPage` | `frontend/src/pages/DealsPage.tsx` | `/deals` | Deals table view and revenue status grouping |
| `DealDetailPage` | `frontend/src/pages/DealDetailPage.tsx` | `/deals/:id` | Deal detail, line items calculator, and quote generation |
| `ProductsPage` | `frontend/src/pages/ProductsPage.tsx` | `/products` | Catalog pricing list (SKUs, categories, unit prices) |
| `QuotesPage` | `frontend/src/pages/QuotesPage.tsx` | `/quotes` | Sales quotes management, status updates, PDF downloads |
| `SequencesPage` | `frontend/src/pages/SequencesPage.tsx` | `/sequences` | Multi-step outreach workflow builder and contact enrollments |
| `TasksPage` | `frontend/src/pages/TasksPage.tsx` | `/tasks` | Task & activity management (overdue, due today, completed) |
| `ForecastingPage` | `frontend/src/pages/ForecastingPage.tsx` | `/forecasting` | Rep quotas, monthly pipeline attainment & rolling trend chart |
| `ReportsPage` | `frontend/src/pages/ReportsPage.tsx` | `/reports` | Analytics reports (Pipeline health, Win/Loss, Funnel) |
| `SearchPage` | `frontend/src/pages/SearchPage.tsx` | `/search` | Global cross-entity search result listings |
| `SettingsPage` | `frontend/src/pages/SettingsPage.tsx` | `/settings` | Team management, role assignment, and custom properties |
| `LoginPage` | `frontend/src/pages/LoginPage.tsx` | `/login` | User authentication sign-in form |
| `RegisterPage` | `frontend/src/pages/RegisterPage.tsx` | `/register` | Workspace registration and first admin onboarding |
