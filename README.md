# Enterprise Sales & Cyber Defence CRM

A production-grade, multi-tenant B2B Sales & Advisory CRM built with TypeScript, Node.js, Fastify, Prisma, PostgreSQL, and React.

---

## Key Features & Business Capabilities

### 1. Hierarchical Organizational Roles (RBAC)
- **Senior Partner**: Full tenant visibility, user hierarchy management, deletion approvals, and org-wide analytics.
- **Partner**: Full management of subordinate Managers, pipeline oversight, stage approval reviews, and deletion sign-offs.
- **Manager**: Scoped visibility to assigned Accounts, Contacts, and Opportunities. Can request stage transitions and opportunity deletions which route directly to their Partner for approval.

### 2. Pipeline & Governance Workflows
- **Visual Kanban Pipeline**: Drag-and-drop opportunity lifecycle stages (Scope Discussion, Proposal Sent, Negotiation, Closed Won, Closed Lost).
- **Automated Stage Approval Gate**: Transitions requiring approval temporarily buffer the opportunity in **Proposal Sent**; upon Partner approval they move to the destination stage; on rejection or revocation they automatically revert to their source stage.
- **Two-Man Rule Deletion**: Managers submit deletion requests with mandatory justification notes. Opportunities remain active until a Partner reviews and executes the atomic cascade delete.
- **Opportunity Type Classification**: Direct scoping for `NEW_BUSINESS`, `EXPANSION`, and `RENEWAL`.

### 3. Financial & Margin Intelligence
- **Proposal Value & Cost Tracking**: Live calculations for *Proposal Value*, *Cost Incurred to Company*, *Margin Value*, and *Margin Percentage*.
- **Weighted Pipeline**: Dynamic probability-weighted valuation per stage.
- **Closed Won Governance**: Mandatory Letter of Engagement (LOE) and Purchase Order (PO) metadata capture before deal closure.

### 4. Communication & Data Integrity
- **Multi-Value Contact Channels**: Multiple emails and phone numbers per contact with primary tagging and ISO country code selection.
- **Batch CSV Import/Export**: Robust bulk data ingestion with field mapping, duplicate detection strategies (`skip`, `update_existing`, `create_new`), and synchronized modern terminology.
- **Audit Logging**: Comprehensive, immutable audit trail of record updates, stage transitions, and approvals.

---

## Technology Stack

- **Backend**: Node.js (v20+), Fastify, TypeScript, Prisma ORM, PostgreSQL 16, Zod, JWT authentication with rate limiting.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, TanStack React Query, React Router v7, Lucide Icons, Recharts.
- **Testing**: Cypress E2E & Integration testing (40 API specs + 24 UI flow specs).
- **Deployment**: Multi-stage Dockerfiles, Docker Compose, Nginx reverse proxy.

---

## Local Development Setup

### Prerequisites
- Node.js v20+ and npm v10+
- PostgreSQL 16+ running locally or in Docker

### 1. Database & Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure DATABASE_URL and JWT_SECRET in .env
npx prisma db push
npm run dev # Starts Fastify API server on http://localhost:4000
```

### 2. Frontend Application
```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev # Starts Vite dev server on http://localhost:5173
```

---

## Docker & Production Deployment

The repository includes complete multi-container Docker configuration for self-hosted and cloud environments (such as Bharat Cloud).

### Build and Run with Docker Compose
```bash
docker-compose up -d --build
```
- **Web UI & API Proxy**: `http://localhost:80`
- **PostgreSQL Database**: `localhost:5432`

For detailed step-by-step production VM configuration, refer to [docs/DEPLOYMENT_BHARAT_CLOUD.md](docs/DEPLOYMENT_BHARAT_CLOUD.md).

---

## Automated QA & Test Execution

Run the complete test suite locally:

```bash
# Run API & RBAC permission tests (40 tests)
npm run beta-test:api

# Run End-to-End Cypress UI workflows (24 tests)
npm run beta-test:e2e
```

---

## License & Intellectual Property
Private and confidential. Unauthorized copying, distribution, or reproduction of this codebase via any medium is strictly prohibited.
