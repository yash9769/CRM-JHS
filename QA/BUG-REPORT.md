# Ledger CRM — Master Bug Report & Remediation Summary

This document details all defects, architectural flaws, validation bugs, and business logic issues discovered during testing, along with their root cause, affected files, resolution, and verification test.

---

## BUG-001: Zod Validation Errors Returning HTTP 500 Instead of 400 Bad Request

- **Severity**: **HIGH (P1)**
- **Feature**: Fastify API Error Handling & Request Validation
- **Affected Files**: `backend/src/app.ts`
- **Steps to Reproduce**:
  1. Send a POST request to `/api/v1/accounts` with `{ name: "" }`.
  2. Observe HTTP status code returned by server.
- **Expected Result**: HTTP 400 Bad Request with a clear Zod validation error message.
- **Actual Result**: Fastify caught the thrown `ZodError`, wrapped it, and returned `HTTP 500 Internal Server Error` because `app.setErrorHandler` was registered after routes and didn't inspect stringified JSON issues payloads.
- **Root Cause**: `app.setErrorHandler` was placed after route plugin registrations in `app.ts` (so Fastify did not bind it to plugin contexts) and did not inspect Zod error JSON message strings.
- **Resolution**:
  - Moved `app.setErrorHandler` before all route plugin registrations in `backend/src/app.ts`.
  - Added robust detection for `ZodError` instances and JSON array error structures.
- **Regression Test**: `ACC-005` & `CON-003` in `tests/api/run-all-tests.ts`. Status: **PASSED**.

---

## BUG-002: User Deletion Crashing with HTTP 500 Database Foreign Key Violation

- **Severity**: **CRITICAL (P0)**
- **Feature**: User Administration & RBAC (`DELETE /api/v1/users/:id`)
- **Affected Files**: `backend/src/routes/users.ts`
- **Steps to Reproduce**:
  1. Create a user who owns an Account, Contact, Opportunity, Deal, or Note.
  2. Admin issues `DELETE /api/v1/users/:id`.
- **Expected Result**: User is removed cleanly after reassigning owned records to admin.
- **Actual Result**: Server throws an unhandled Prisma foreign key constraint error (`P2003` / `P2014`) and returns `HTTP 500 Internal Server Error`.
- **Root Cause**: `users.ts` directly executed `prisma.user.delete()` without reassigning foreign key references in `ownedAccounts`, `ownedContacts`, `ownedOpportunities`, `ownedDeals`, `ownedQuotes`, `ownedProducts`, `activities`, `notes`, `sequences`.
- **Resolution**: Implemented transactional batch reassignment in `backend/src/routes/users.ts` to reassign all 9 owned relationship models to the requesting Admin (`req.authUser.id`) before deleting the user.
- **Regression Test**: `USER-001` in `tests/api/run-all-tests.ts`. Status: **PASSED**.

---

## BUG-003: Marking Deal "Closed Won" Failing with HTTP 400 when Close Date Missing

- **Severity**: **HIGH (P1)**
- **Feature**: Deals Workflow & Closed Won Business Logic (`PATCH /api/v1/deals/:id`)
- **Affected Files**: `backend/src/routes/deals.ts`
- **Steps to Reproduce**:
  1. Create a Deal without specifying a `closeDate`.
  2. Click "Mark Won" on Deal Detail page or drag to Closed Won on Kanban board.
- **Expected Result**: Deal is updated to Closed Won stage seamlessly with close date defaulting to current date.
- **Actual Result**: API rejects request with HTTP 400: `"A close date is required to mark a deal Closed Won"`.
- **Root Cause**: `deals.ts` required `closeDate` to be present on the model or request body when transitioning to Closed Won. If omitted, it returned 400 error.
- **Resolution**: Updated `backend/src/routes/deals.ts` so that when a deal is marked Closed Won and no `closeDate` is specified, `closeDate` automatically defaults to `new Date()`.
- **Regression Test**: `DEAL-002` in `tests/api/run-all-tests.ts` and E2E CRM lifecycle test. Status: **PASSED**.

---

## BUG-004: Account `annualRevenue` Remaining NULL on Deal "Closed Won"

- **Severity**: **MEDIUM (P2)**
- **Feature**: Account Revenue Aggregation & Deals Integration
- **Affected Files**: `backend/src/routes/deals.ts`
- **Steps to Reproduce**:
  1. Create an Account without specifying `annualRevenue` (defaults to `null`).
  2. Create a Deal for the account worth 500,000.
  3. Close the Deal as Won.
- **Expected Result**: Account `annualRevenue` increases to 500,000.
- **Actual Result**: Account `annualRevenue` remained `null` because SQL `NULL + 500000 = NULL`.
- **Root Cause**: `deals.ts` used Prisma `{ annualRevenue: { increment: amount } }`, which in PostgreSQL evaluates to `NULL + amount = NULL`.
- **Resolution**: Updated `backend/src/routes/deals.ts` to check account `annualRevenue` and compute `(currentRevenue || 0) + dealAmount` safely.
- **Regression Test**: `DEAL-002` in `tests/api/run-all-tests.ts`. Status: **PASSED**.
