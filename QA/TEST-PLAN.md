# Ledger CRM — Master Quality Assurance & Test Strategy Document

**Author**: Senior QA Automation Engineer & Application Reliability Team  
**Scope**: Full-stack B2B Sales CRM (Frontend, Backend Fastify REST API, Prisma ORM, PostgreSQL Database, Business Logic & Security)  
**Status**: APPROVED & EXECUTED  

---

## 1. Executive Summary

This Test Plan defines the complete end-to-end quality assurance methodology, architectural discovery, testing scopes, risk assessments, test environments, and execution workflows for Ledger CRM.

Ledger CRM is a multi-tenant B2B Sales CRM featuring:
- Multi-tenant tenant isolation (`tenantId`) and role-based access control (`ADMIN`, `SALES_MANAGER`, `SALES_REP`, `VIEWER`).
- Complete core sales workflow: Accounts, Contacts, Opportunities, Opportunity-to-Deal Conversion, Deals with Product Line Items, Closed Won/Lost business logic.
- Extended platform capabilities: Quotes, Multi-step Sequences, Sales Forecasting, Executive Reports (Pipeline Health, Owner Performance, Win/Loss, Conversion Funnel), Custom Property Definitions, Activity/Note timelines, Real-time Notifications, and Global Search.

---

## 2. System Architecture & Component Mapping

```text
               ┌──────────────────────────────────────────────┐
               │    React 19 + TypeScript + Vite + Tailwind   │
               │   (Axios + React Query + React Router v7)    │
               └──────────────────────┬───────────────────────┘
                                      │ REST API / JWT
                                      ▼
               ┌──────────────────────────────────────────────┐
               │    Fastify v5 TypeScript Server (Port 4000)   │
               │    (Zod Validation, Argon2 Auth, Audit Log)  │
               └──────────────────────┬───────────────────────┘
                                      │ Prisma ORM
                                      ▼
               ┌──────────────────────────────────────────────┐
               │       PostgreSQL 16 Relational Database      │
               │       (Multi-tenant schemas & indexes)       │
               └──────────────────────────────────────────────┘
```

### Component Inventory & Data Flow Map
1. **Authentication & Multi-Tenancy**:
   - `POST /api/v1/auth/register` creates a new `Tenant` and initial `ADMIN` user, seeding default Opportunity and Deal pipelines (`Pipeline` and `PipelineStage`).
   - `POST /api/v1/auth/login` verifies Argon2 hash and issues signed JWT containing `{ id, tenantId, role, email }`.
   - All protected routes pass through `@fastify/jwt` preHandler (`app.authenticate`), setting `req.authUser`.
2. **Account Management**:
   - `Account` records isolated by `tenantId`. Supports CRUD, pagination, full-text search across name/domain, sorting, and linked contacts/opportunities/deals.
3. **Contact Management**:
   - `Contact` records belong to a `Tenant` and optional `Account`. Linked to opportunities and deals via join tables (`OpportunityContact`, `DealContact`).
4. **Opportunity & Pipeline Workflow**:
   - `Opportunity` tracks stage progression, expected close dates, probability, and amount.
   - `POST /api/v1/opportunities/:id/convert` converts a qualified opportunity to a `Deal`, retaining account, contact associations, amount, notes, and activity history without deleting the opportunity.
5. **Deals & Pricing Engine**:
   - `Deal` records contain line items (`LineItem`) with products (`Product`), unit prices, discount percentages, and tax percentages.
   - Transition to `Closed Won` stage enforces valid deal amount, populates `wonDate`, defaults `closeDate` if omitted, and increments the account's total `annualRevenue`.
6. **Dashboard & Analytics**:
   - `GET /api/v1/dashboard` computes total open pipeline, weighted pipeline, closed won revenue, win rate percentage, average deal size, deals closing this month, and chart series.

---

## 3. Test Strategy & Phases

### Phase 0 — Codebase Discovery
Inspected backend Fastify server setup, Prisma schema, frontend React router, custom hooks, and state management. Identified all API routes, database indices, and foreign key cascades.

### Phase 1 — Functional Inventory
Mapped every supported entity, endpoint, user interaction, form input, validation constraint, and dashboard formula.

### Phase 2 & 3 — Dedicated Test Environment & Test Data
- Created deterministic test dataset with prefixed identifiers (`TEST_Account_001`, `TEST_Contact_001`, `TEST_Opportunity_001`, `TEST_Deal_001`).
- Run tests against dedicated test tenants and isolated databases to prevent production data corruption.

### Phase 4 — Test Matrix
Mapped test cases with unique IDs (`AUTH-001`, `ACC-001`, `CON-001`, `OPP-001`, `DEAL-001`, `DASH-001`, `SEC-001`, `USER-001`, `QUOTE-001`, `REP-001`, `SEARCH-001`). Priority ratings: `P0` (Critical), `P1` (High), `P2` (Normal), `P3` (Minor).

### Phase 5 - 24 — Automated API & E2E Testing
- Built direct Fastify API integration test suite (`tests/api/run-all-tests.ts`).
- Built Playwright browser automation E2E suite (`tests/e2e/crm-lifecycle.spec.ts`, `auth.spec.ts`, `accounts.spec.ts`, `contacts.spec.ts`).

### Phase 25 & 26 — Bug Remediation & Regression Testing
Discovered, logged, and fixed all high/critical bugs (Zod 400 error status formatting, deal Close Won close date defaulting, null annualRevenue account calculation, user deletion cascade/reassignment). Re-ran full regression suite to achieve 100% pass rate.

### Phase 27 & 28 — Acceptance & Delivery
Generated all QA artifacts and confirmed application readiness.
