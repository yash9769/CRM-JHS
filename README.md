# Ledger CRM — Full-Stack B2B Sales CRM

A production-ready, multi-tenant B2B Sales CRM covering the complete PRD.

## What's implemented (100% of PRD features)

### Core Sales Workflow
- Auth (register/login/JWT), multi-tenant workspace isolation
- Accounts (CRUD, industry, type, revenue tracking)
- Contacts (CRUD, linked to accounts, lifecycle stages)
- Opportunities → Pipeline Kanban (drag-and-drop stages, stage history)
- Opportunity → Deal conversion (preserves all data, audit trail)
- Deals (line items with pricing, Closed Won/Lost business rules)
- Products (catalog with SKU, category, unit price)

### Phase 2 — Quotes & Sequences
- **Quotes**: Generate from deal, manage status (Draft→Sent→Accepted/Rejected), line items, discounts, tax
- **Sequences**: Multi-step outreach workflows (Email/Call/Wait/Task steps), contact enrollment, status tracking

### Phase 3 — Analytics
- **Forecasting**: Set monthly targets by rep, track attainment vs. pipeline, 12-month trend chart
- **Reports**: Pipeline health by stage, owner performance, Win/Loss analysis + monthly trend, Conversion funnel

### Phase 4 — Platform
- **Global Search**: Cross-object search across accounts, contacts, opportunities, deals
- **Notifications**: Real-time bell (polls every 30s), mark read, mark all read
- **Team / RBAC**: Invite members, assign roles (Admin/Sales Manager/Sales Rep/Viewer), role-based enforcement
- **Custom Properties**: Define TEXT/NUMBER/BOOLEAN/DATE/SELECT fields per object type
- **Activities & Notes**: Shared timeline on every record (log call, email, meeting, task; add note)
- **Dashboard**: KPIs + Revenue by Month + Pipeline by Stage charts

## Stack
- **Backend**: Node.js + TypeScript + Fastify + Prisma + PostgreSQL 16
- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 + React Query + React Router + Recharts

## Quick start

### Backend
```bash
cd backend
npm install
cp .env.example .env       # edit DATABASE_URL + JWT_SECRET
npx prisma migrate dev
npm run dev                # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev                # http://localhost:5173
```

Go to http://localhost:5173/register — registering creates a workspace and seeds default Opportunity + Deal pipelines automatically.

## API surface (all JWT-protected)

```
Auth:           POST /auth/register, /auth/login, GET /auth/me
Pipelines:      GET /pipelines
Accounts:       GET|POST /accounts, GET|PATCH|DELETE /accounts/:id
Contacts:       GET|POST /contacts, GET|PATCH|DELETE /contacts/:id
Opportunities:  GET|POST /opportunities, GET|PATCH|DELETE /opportunities/:id
                POST /opportunities/:id/convert
Deals:          GET|POST /deals, GET|PATCH|DELETE /deals/:id
                POST /deals/:id/line-items, DELETE /deals/:id/line-items/:lid
Products:       GET|POST /products, PATCH /products/:id
Activities:     GET|POST /activities, PATCH /activities/:id
Notes:          POST /notes, PATCH|DELETE /notes/:id
Quotes:         GET|POST /quotes, GET|PATCH /quotes/:id, DELETE /quotes/:id
Sequences:      GET|POST /sequences, GET|PATCH|DELETE /sequences/:id
                POST /sequences/:id/steps, DELETE /sequences/:id/steps/:sid
                POST /sequences/:id/enroll, GET /sequences/:id/enrollments
                DELETE /sequences/:id/enrollments/:eid
Forecasting:    GET /forecast, POST /forecast/targets, GET /forecast/targets, GET /forecast/trend
Search:         GET /search?q=
Notifications:  GET /notifications, PATCH /notifications/:id/read
                POST /notifications/read-all, GET /notifications/unread-count
                DELETE /notifications/:id
Reports:        GET /reports/pipeline-health
                GET /reports/owner-performance
                GET /reports/win-loss
                GET /reports/conversion-funnel
Properties:     GET|POST /properties, DELETE /properties/:id
Users:          GET /users, GET /users/stats
                POST /users/invite, PATCH /users/:id, DELETE /users/:id
Dashboard:      GET /dashboard
```
