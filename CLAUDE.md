# CLAUDE.md — Project Memory & AI Operating Guide

## Tech Stack & Key Dependencies
- **Backend**: Node.js (ES Modules, TypeScript 5.6), Fastify 5.1, Prisma 5.20/5.22, PostgreSQL 16
  - Auth: `@fastify/jwt` (stateless JWT authentication with dynamic DB-backed tenant resolution), `argon2`
  - Validation: `zod` (runtime schema validation on all inputs)
  - Utilities: `pdfkit` (server-side PDF quote rendering)
- **Frontend**: React 19, TypeScript 6.0, Vite 8.2, Tailwind CSS 4, React Router DOM 7
  - Data Fetching: `@tanstack/react-query` (server cache, optimistic invalidation)
  - HTTP Client: `axios` (with 401 interception & bearer token injection)
  - UI & Icons: `lucide-react`, `clsx`, custom tokens (`var(--ink-*)`, `var(--accent-*)`)
  - Charts: `recharts` (BarChart, LineChart, AreaChart, PieChart)
  - Utilities: `date-fns`, `papaparse` (CSV import/export parsing)

---

## Folder Structure
```
/
├── CLAUDE.md                  # Project overview & AI context rules
├── FUNCTIONS.md               # Complete registry of all functions, routes, components
├── ARCHITECTURE.md            # System architecture & data flow design
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Multi-tenant PostgreSQL database schema
│   │   ├── seed.ts            # Default seed script
│   │   ├── seed_yash.ts       # Comprehensive multi-tenant seeder
│   │   └── seed_d.ts          # Dedicated tenant seeder
│   ├── src/
│   │   ├── app.ts             # Fastify application builder, middleware, route registration
│   │   ├── server.ts          # Server entry point (binds port 4000)
│   │   ├── lib/               # Shared backend utilities (prisma, audit, csv, quotePdf)
│   │   ├── plugins/           # Fastify plugins (JWT auth decorator)
│   │   └── routes/            # Modular route controllers (19 REST endpoints)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx           # React root renderer
│   │   ├── App.tsx            # React router, route guard & query client provider
│   │   ├── index.css          # Design system variables, Tailwind CSS v4 entry
│   │   ├── hooks/             # React custom hooks (useAuth)
│   │   ├── lib/               # Frontend utilities (api, format, pickers, types)
│   │   ├── components/        # Reusable UI components & modals
│   │   └── pages/             # 22 View pages (Dashboard, CRM objects, Detail views)
│   ├── package.json
│   └── vite.config.ts
```

---

## Coding Conventions & Patterns
- **Multi-Tenancy Isolation**:
  - Every table (except system metadata) MUST include `tenantId`.
  - Every query MUST filter by `tenantId: req.authUser.tenantId`. Never execute cross-tenant queries.
- **Backend Route Pattern**:
  - Declare routes in `backend/src/routes/<domain>.ts` exporting default async function accepting `FastifyInstance`.
  - Validate request payload/query with `zod.parse()`.
  - Wrap multi-table side-effects with `prisma.$transaction`.
  - Record mutations using `logAudit()` and send alerts via `notify()`.
- **Error Handling**:
  - Fastify central error handler in `app.ts` parses `ZodError` to `400 Bad Request`.
  - Return `{ error: string, details?: any }` format with appropriate HTTP status codes (400, 401, 403, 404, 409).
- **Frontend State & Data Fetching**:
  - Use React Query `useQuery` with descriptive keys (e.g. `["accounts", params]`).
  - Use `useMutation` for writes, invalidating relevant query keys in `onSuccess`.
  - Use `api` axios instance (`/src/lib/api.ts`) for all HTTP calls — never raw `fetch`.
- **Naming & Formatting**:
  - Backend files: camelCase (`auditHistory.ts`).
  - Frontend components/pages: PascalCase (`AccountDetailPage.tsx`).
  - Types/Interfaces: PascalCase (`Opportunity`, `AuthUser`).

---

## How to Run, Build & Test
- **Start Backend**:
  ```bash
  cd backend && npm run dev       # Runs tsx watch src/server.ts on http://localhost:4000
  ```
- **Start Frontend**:
  ```bash
  cd frontend && npm run dev      # Runs Vite dev server on http://localhost:5173
  ```
- **Database Migrations / Schema Sync**:
  ```bash
  cd backend && npm run prisma:generate && ./node_modules/.bin/prisma db push
  ```
- **Seed Demo Data**:
  ```bash
  cd backend && npx tsx prisma/seed_yash.ts
  ```
- **Build Production Bundles**:
  ```bash
  cd backend && npm run build
  cd frontend && npm run build
  ```

---

## Inviolable Rules (Never Change Without Asking)
- **Tenant Isolation**: Never omit `where: { tenantId }` in Prisma queries or expose data across workspaces.
- **Port Consistency**: Backend is fixed on `PORT=4000`, Frontend is on `PORT=5173`.
- **Password Security**: Argon2 hashing is mandatory for user password storage.
- **Prisma Schema ID Types**: Primary keys use `String @id @default(uuid())` across all models.
- **Currency Standard**: Default currency display standard is Indian Rupee (`INR` / `₹`) with `en-IN` formatting.
- **Registry Synchronization**: Always update `FUNCTIONS.md` immediately whenever a function, component, or route is added or modified.
