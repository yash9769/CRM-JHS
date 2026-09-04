# Phase 2A — RBAC Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close real record-visibility gaps found by an RBAC audit — several backend route files currently let a Manager view/edit/delete any record of that type tenant-wide instead of only their own — and hide the "Filter by owner" control from Managers on the frontend, matching the existing Export-CSV gating pattern.

**Architecture:** Backend-only for 9 of 10 tasks (Fastify routes calling the existing `backend/src/lib/rbac.ts` helpers — no new authorization logic, just applying what already exists consistently). One frontend task adds a role check to 5 existing pages.

**Tech Stack:** Fastify 5.1, Prisma, TypeScript. `backend/src/lib/rbac.ts` exports `getVisibleUserIds(user)`, `getCreatedByFilter(user)` (Prisma `where` fragment), `requireCanAccess(user, record)` (throws with `.statusCode = 403`, caught by the global error handler in `app.ts:37`), `requireExportPermission(user)`.

## Global Constraints

- Every fix must preserve exact current behavior for SENIOR_PARTNER (unrestricted) — only PARTNER and MANAGER visibility should ever narrow.
- `requireCanAccess(user, record)` expects `record` to have `createdById` and/or `ownerId` fields — when loading a record for this check, select at least those two fields.
- No git commit in this branch should carry a "Co-Authored-By" or AI/Claude attribution trailer.
- `cd backend && npm run build` must pass clean after every task (backend-only changes for tasks 1-9; task 10 also needs `cd frontend && npm run build` clean).
- This repo has no unit test suite for these routes — verification is the build, plus a manual/curl check per task comparing a Manager-role request against a Partner-role request for the same record.

---

### Task 1: Leads RBAC

**Files:**
- Modify: `backend/src/routes/leads.ts`

**Interfaces:**
- Consumes: `getCreatedByFilter(user): Promise<{OR: [...]} | {}>`, `requireCanAccess(user, record: {createdById?, ownerId?}): Promise<void>` from `../lib/rbac.js`.

- [ ] **Step 1: Import the RBAC helpers**

Add to the top of `backend/src/routes/leads.ts`:
```ts
import { getCreatedByFilter, requireCanAccess } from "../lib/rbac.js";
```

- [ ] **Step 2: Scope the export endpoint**

Find `GET /api/v1/leads/export`. Its `where` clause is currently tenant-only. Add the rbac filter the same way `GET /api/v1/leads` (list) already does — find that handler first and copy its exact pattern (likely `...(await getCreatedByFilter(req.authUser))` spread into the `where` object).

- [ ] **Step 3: Guard single-record endpoints**

For each of `GET /api/v1/leads/:id`, `PATCH /api/v1/leads/:id`, `DELETE /api/v1/leads/:id`, `POST /api/v1/leads/:id/archive`, `POST /api/v1/leads/:id/convert`:
- Ensure the handler loads the lead first (most likely already do, to return 404 if missing) with at least `createdById` and `ownerId` selected/included.
- Immediately after confirming the record exists (before doing anything else with it), add:
```ts
await requireCanAccess(req.authUser, lead);
```
(use whatever the loaded variable is actually named in each handler). Let the thrown error propagate — do not wrap in try/catch; the global error handler in `app.ts` already maps `err.statusCode` to the HTTP response.

- [ ] **Step 4: Guard the bulk endpoint**

Find `POST /api/v1/leads/bulk`. After loading the target leads by `id in body.ids` (and tenant), filter the loaded list down to only those visible via `getVisibleUserIds(req.authUser)` (import this too if the filter approach needs it directly rather than via `getCreatedByFilter`). Any id in `body.ids` that isn't in the visible set must NOT be silently processed — either exclude it from the bulk operation and include which ids were skipped in the response, or reject the whole request with a 403 listing the disallowed ids. Pick whichever fits the existing response shape with the least structural change, and note the choice in your commit message.

- [ ] **Step 5: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 6: Manual verification**

With the backend running and two JWTs (one for `manager@crm.com` / `Password123!`, one for `partner@crm.com` / `Password123!` — seeded test accounts, see `backend/prisma/seed.ts`), find a lead owned by a different manager (not `manager@crm.com`) and confirm: `GET /api/v1/leads/:id` for that lead returns 403 as the Manager but 200 as the Partner (assuming the lead's owner reports to that partner) or as Senior Partner.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/leads.ts
git commit -m "Add RBAC checks to Leads routes

GET/PATCH/DELETE/:id, archive, convert, export, and bulk previously
had no record-level visibility enforcement -- any Manager could
access any tenant lead. Now uses the existing rbac.ts helpers,
matching the pattern already used on the list endpoint."
```

---

### Task 2: Quotes RBAC

**Files:**
- Modify: `backend/src/routes/quotes.ts`

**Interfaces:**
- Consumes: same `getCreatedByFilter`/`requireCanAccess` as Task 1. File already imports `requireExportPermission` from `../lib/rbac.js` — add to that same import line.

- [ ] **Step 1: Extend the rbac import**

Add `getCreatedByFilter, requireCanAccess` to the existing `../lib/rbac.js` import line in `backend/src/routes/quotes.ts`.

- [ ] **Step 2: Scope list and export**

`GET /api/v1/quotes` and `GET /api/v1/quotes/export`: both currently build a tenant-only `where`. Add `...(await getCreatedByFilter(req.authUser))` to each. Note: `requireExportPermission(req.authUser)` already runs on export to block Manager entirely — the rbacFilter addition is still correct/needed for Partner (who can export, but only their own team's quotes).

- [ ] **Step 3: Guard single-record endpoints**

For `GET /api/v1/quotes/:id`, `PATCH /api/v1/quotes/:id`, `DELETE /api/v1/quotes/:id`, `GET /api/v1/quotes/:id/pdf`, `POST /api/v1/quotes/:id/duplicate`: load the quote with `ownerId` (and `createdById` if the model has it — check `Quote` in `backend/prisma/schema.prisma`) selected, then call `await requireCanAccess(req.authUser, quote)` right after confirming it exists, before any further logic.

- [ ] **Step 4: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 5: Manual verification**

Same pattern as Task 1 Step 6, against a quote instead of a lead.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/quotes.ts
git commit -m "Add RBAC checks to Quotes routes

This file had zero record-level RBAC despite Quote having an
ownerId -- any tenant user could view/edit/delete/duplicate/download
the PDF for any quote. Now scoped with the existing rbac.ts helpers."
```

---

### Task 3: Activities & Notes RBAC

**Files:**
- Modify: `backend/src/routes/activities.ts`

**Interfaces:**
- Consumes: `getCreatedByFilter`, `requireCanAccess` from `../lib/rbac.js`. `Note` uses `authorId` (not `ownerId`) per `backend/prisma/schema.prisma:610-611` — `requireCanAccess` checks `createdById`/`ownerId` on the record, so for notes, pass an object shaped `{ ownerId: note.authorId }` (or `{ createdById: note.authorId }` — either field name `requireCanAccess` checks works identically) rather than expecting it to know about `authorId` directly.

- [ ] **Step 1: Import the RBAC helpers**

Add `getCreatedByFilter, requireCanAccess` to `backend/src/routes/activities.ts`'s imports from `../lib/rbac.js` (file already imports `requireExportPermission` from there).

- [ ] **Step 2: Scope list and export**

`GET /api/v1/activities` and `GET /api/v1/activities/export`: add the rbacFilter to each `where` clause (currently tenant-only; the existing `ownerId` query param is an optional filter, not an enforced restriction — leave that param working as-is, just add the rbacFilter alongside it).

- [ ] **Step 3: Guard PATCH /activities/:id**

Load the activity with `ownerId` selected, call `requireCanAccess(req.authUser, activity)` after confirming it exists.

- [ ] **Step 4: Guard notes endpoints**

`PATCH /api/v1/notes/:id` and `DELETE /api/v1/notes/:id`: load the note with `authorId` selected, then call:
```ts
await requireCanAccess(req.authUser, { ownerId: note.authorId });
```
`POST /api/v1/notes` (create) does not need a check — you can't violate visibility by creating a new record you own.

- [ ] **Step 5: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 6: Manual verification**

Same pattern as prior tasks, against an activity and a note.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/activities.ts
git commit -m "Add RBAC checks to Activities and Notes routes

List/export/PATCH on activities, and PATCH/DELETE on notes, had no
visibility enforcement despite both models having an owner/author
field. Now scoped with the existing rbac.ts helpers."
```

---

### Task 4: Sequences RBAC

**Files:**
- Modify: `backend/src/routes/sequences.ts`

**Interfaces:**
- Consumes: `getCreatedByFilter`, `requireCanAccess` from `../lib/rbac.js` (not currently imported in this file at all).
- Routes in this file: `GET /api/v1/sequences` (list), `GET /api/v1/sequences/:id`, `POST /api/v1/sequences`, `PATCH /api/v1/sequences/:id`, `DELETE /api/v1/sequences/:id`, `POST /api/v1/sequences/:id/steps`, `DELETE /api/v1/sequences/:id/steps/:stepId`, `POST /api/v1/sequences/:id/enroll`, `GET /api/v1/sequences/:id/enrollments`, `DELETE /api/v1/sequences/:id/enrollments/:enrollmentId`.

- [ ] **Step 1: Import the RBAC helpers**

Add to `backend/src/routes/sequences.ts`:
```ts
import { getCreatedByFilter, requireCanAccess } from "../lib/rbac.js";
```

- [ ] **Step 2: Scope the list endpoint**

`GET /api/v1/sequences`: add `...(await getCreatedByFilter(req.authUser))` to its `where` (currently tenant-only; `Sequence.ownerId` is set to the creator at line 61 of this file per the audit — confirm this field name and use it consistently).

- [ ] **Step 3: Guard the direct sequence endpoints**

`GET /api/v1/sequences/:id`, `PATCH /api/v1/sequences/:id`, `DELETE /api/v1/sequences/:id`: load with `ownerId` selected, call `requireCanAccess(req.authUser, sequence)` after confirming existence.

- [ ] **Step 4: Guard the sub-resource endpoints (steps, enroll, enrollments)**

`POST /:id/steps`, `DELETE /:id/steps/:stepId`, `POST /:id/enroll`, `GET /:id/enrollments`, `DELETE /:id/enrollments/:enrollmentId`: each of these operates on a child of a sequence identified by `:id`. Load the PARENT sequence (with `ownerId`) and call `requireCanAccess` on it — do not attempt a separate ownership model for steps/enrollments themselves, they inherit visibility from their parent sequence.

- [ ] **Step 5: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 6: Manual verification**

Same pattern as prior tasks, against a sequence.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/sequences.ts
git commit -m "Add RBAC checks to Sequences routes

No RBAC helper was imported in this file at all despite Sequence
having an ownerId set at creation. List and all id-scoped endpoints
(including steps/enroll/enrollments sub-routes, which inherit
visibility from their parent sequence) now use the existing rbac.ts
helpers."
```

---

### Task 5: Opportunities sub-route gaps

**Files:**
- Modify: `backend/src/routes/opportunities.ts`

**Interfaces:**
- Consumes: `getCreatedByFilter`, `requireCanAccess`, `getVisibleUserIds` — file already imports `getCreatedByFilter, requireCanAccess, requireExportPermission` from `../lib/rbac.js` (line 6); add `getVisibleUserIds` to that same line for the bulk endpoint.
- Exact routes to fix (confirmed line numbers as of this plan's writing — re-grep if they've shifted): `GET /api/v1/opportunities/export` (~185), `DELETE /api/v1/opportunities/:id` (~1212), `POST /api/v1/opportunities/:id/attachments` (~1171), `DELETE /api/v1/opportunities/:id/attachments/:attachmentId` (~1201), `POST /api/v1/opportunities/:id/line-items` (~1225), `DELETE /api/v1/opportunities/:opportunityId/line-items/:lineItemId` (~1259, note the param is named `:opportunityId` not `:id` on this one route), `POST /api/v1/opportunities/:id/archive` (~1270), `POST /api/v1/opportunities/bulk` (~1279).

- [ ] **Step 1: Scope the export endpoint**

`GET /api/v1/opportunities/export`: add `...(await getCreatedByFilter(req.authUser))` to its `where`, matching the already-correct pattern in the list endpoint (`GET /api/v1/opportunities`) just above it in the file.

- [ ] **Step 2: Guard DELETE /:id**

Load the opportunity (or reuse if already loaded earlier in the handler) with `createdById`/`ownerId` selected, call `requireCanAccess(req.authUser, opportunity)` before deleting.

- [ ] **Step 3: Guard attachment and line-item sub-routes**

For `POST /:id/attachments`, `DELETE /:id/attachments/:attachmentId`, `POST /:id/line-items`, `DELETE /:opportunityId/line-items/:lineItemId` (mind the differently-named param on this last one): load the PARENT opportunity and call `requireCanAccess` on it before performing the sub-resource operation — same "inherit from parent" pattern as Task 4's sequence steps.

- [ ] **Step 4: Guard POST /:id/archive**

Load the opportunity, call `requireCanAccess` before archiving.

- [ ] **Step 5: Guard POST /bulk**

Add `getVisibleUserIds` to the rbac import. After loading the target opportunities by `id in body.ids` + tenant, filter to only those visible via `getVisibleUserIds(req.authUser)` — same exclude-or-reject choice as Task 1 Step 4 (Leads bulk); be consistent with whichever approach you chose there if practical, but each file's existing response shape takes priority over cross-file consistency.

- [ ] **Step 6: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 7: Manual verification**

Same pattern as prior tasks, against an opportunity's delete/archive/attachment endpoints.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/opportunities.ts
git commit -m "Add RBAC checks to Opportunities sub-routes

Export, delete, archive, attachments, line-items, and bulk endpoints
were inconsistent with the already-correct list/GET/PATCH endpoints
in this file -- some had no requireCanAccess check at all. Sub-routes
now inherit visibility from their parent opportunity."
```

---

### Task 6: Products RBAC + dead code removal

**Files:**
- Modify: `backend/src/routes/products.ts`

**Interfaces:**
- Consumes: `requireCanAccess` from `../lib/rbac.js` (file already imports `getCreatedByFilter` for the list endpoint per the audit — add `requireCanAccess` to that import).

- [ ] **Step 1: Guard PATCH /products/:id**

Load the product with `createdById`/`ownerId` selected (check `Product` model in `backend/prisma/schema.prisma` for the exact owner field name — audit noted `createdById`), call `requireCanAccess(req.authUser, product)` after confirming existence, before applying the update.

- [ ] **Step 2: Investigate and remove the no-op role check**

Around `backend/src/routes/products.ts:60-67` there's an inline check hard-coding `["SENIOR_PARTNER","PARTNER","MANAGER"]` — all three roles, so it currently blocks nothing and does nothing. Run `git log -p --follow -- backend/src/routes/products.ts | grep -B5 -A15 "SENIOR_PARTNER.*PARTNER.*MANAGER"` (or equivalent) to check history for whether this was ever a narrower list that got mistakenly widened, which would indicate real intended stricter behavior. If history shows no evidence of an intended stricter rule (e.g. it was written this way from the start, or the broadening was clearly intentional), delete the dead check entirely. If you find evidence suggesting `unitPrice` edits were meant to be Partner+ only, do NOT silently narrow it back — instead leave the current permissive behavior in place and note the finding in your commit message and report for a human decision, since changing who can edit pricing is a business-rule change beyond this task's RBAC-visibility scope.

- [ ] **Step 3: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 4: Manual verification**

Same pattern as prior tasks, against a product PATCH.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/products.ts
git commit -m "Add RBAC check to Products PATCH, remove no-op role check

PATCH /products/:id had no requireCanAccess call. Also removed (or
documented, if history suggested different original intent) a dead
inline role check that listed all three roles and therefore blocked
nothing."
```

---

### Task 7: Audit history exploitable gap

**Files:**
- Modify: `backend/src/routes/auditHistory.ts`

**Interfaces:**
- Consumes: `getVisibleUserIds`, `requireCanAccess` (already imported in this file).

**Context:** Current code (`backend/src/routes/auditHistory.ts:16-28`) only runs `requireCanAccess` when `objectType === "OPPORTUNITY" && recordId`. The visible-user-ids fallback (`:37-40`) only applies `if (!recordId)`. This means a request like `GET /api/v1/audit-log?objectType=LEAD&recordId=<any-id>` bypasses BOTH checks — any tenant user can read the audit trail for any Lead, Account, Contact, Quote, or Activity record regardless of ownership.

- [ ] **Step 1: Generalize the per-record check**

Replace the `objectType === "OPPORTUNITY"`-only branch (lines 16-28) with a check that runs for every `objectType` when `recordId` is present. Structure:
```ts
if (recordId && objectType) {
  const record = await loadRecordForVisibilityCheck(objectType, recordId);
  if (record) {
    try {
      await requireCanAccess(req.authUser, record);
    } catch (err: any) {
      return reply.code(403).send({ error: `Access denied to ${objectType.toLowerCase()} logs` });
    }
  }
}
```
where `loadRecordForVisibilityCheck` is a small local helper (define it in this file, doesn't need to be exported) that maps `objectType` to the right Prisma model and selects `{ createdById: true, ownerId: true }` (or the closest equivalent field per model — for `ACTIVITY` that's `ownerId`; check each of `Account`, `Contact`, `Lead`, `Quote`, `Activity` in `backend/prisma/schema.prisma` for their actual owner field names, they may not all be identically named). For any `objectType` value not in your mapped list (e.g. reference/system objects with no owner concept), fall back to tenant-only (no additional check) and leave a comment explaining why.

- [ ] **Step 2: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 3: Manual verification**

As a Manager, request `GET /api/v1/audit-log?objectType=LEAD&recordId=<a-lead-not-owned-by-this-manager>` and confirm 403. Request the same for a lead this manager DOES own and confirm success.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auditHistory.ts
git commit -m "Fix audit-log RBAC bypass for non-Opportunity record types

The per-record visibility check only ran for objectType=OPPORTUNITY;
any other type (Lead, Account, Contact, Quote, Activity) with a
recordId bypassed both the per-record check and the visible-user-ids
fallback, letting any tenant user read any record's audit trail.
Generalized the check to run for every recognized objectType."
```

---

### Task 8: Forecasting targets RBAC

**Files:**
- Modify: `backend/src/routes/forecasting.ts`

**Interfaces:**
- Consumes: `getCreatedByFilter` (file already imports it for opportunity queries; extend usage to the target queries too).

- [ ] **Step 1: Scope GET /forecast/targets**

Add `...(await getCreatedByFilter(req.authUser))` to the `where` clause of the `ForecastTarget` query in `GET /api/v1/forecast/targets` (currently tenant-only despite `ForecastTarget.ownerId` existing).

- [ ] **Step 2: Scope the target aggregate in GET /forecast/trend**

Find the `forecastTarget.aggregate` call (around line 190-193). Add the same rbacFilter to its `where` that the opportunity queries elsewhere in this same handler already use — currently this aggregate pulls tenant-wide targets into the trend line regardless of caller visibility, inconsistent with the rest of the endpoint.

- [ ] **Step 3: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 4: Manual verification**

Compare `GET /api/v1/forecast/targets` and `GET /api/v1/forecast/trend` responses between a Manager and a Partner/Senior Partner with different target data — confirm the Manager only sees their own target(s).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/forecasting.ts
git commit -m "Scope forecast targets by RBAC visibility

GET /forecast/targets and the target aggregate inside /forecast/trend
returned all tenant ForecastTarget rows regardless of caller
visibility, despite the model having an ownerId. Now consistent with
the rest of this file's already-correct opportunity queries."
```

---

### Task 9: Users list refactor

**Files:**
- Modify: `backend/src/routes/users.ts`

**Interfaces:**
- Consumes: `getVisibleUserIds` (already imported in this file).

**Context:** `GET /api/v1/users` (lines 40-57) currently hand-rolls:
```ts
let where: any = { tenantId: actor.tenantId };
if (actor.orgRole === "PARTNER") {
  where = { tenantId: actor.tenantId, OR: [{ id: actor.id }, { partnerId: actor.id }] };
} else if (actor.orgRole === "MANAGER") {
  where = { tenantId: actor.tenantId, id: actor.id };
}
```
This must be replaced with a call to the shared `getVisibleUserIds` helper so the two implementations can't drift apart, while producing IDENTICAL results for all three roles.

- [ ] **Step 1: Replace the hand-rolled logic**

```ts
const visibleIds = await getVisibleUserIds(actor);
const where: any = { tenantId: actor.tenantId, id: { in: visibleIds } };
```
Verify this is behaviorally identical: for SENIOR_PARTNER, `getVisibleUserIds` returns all tenant user ids, so `id: {in: allIds}` combined with `tenantId` is equivalent to the current no-extra-filter case (a user can't have an id outside their own tenant's user list here since `getVisibleUserIds` already scopes by `user.tenantId` internally — confirm this by reading `rbac.ts`). For PARTNER, `getVisibleUserIds` returns `[self, ...managers]` which matches the current `OR: [{id: self}, {partnerId: self}]` exactly (same set of users, different query shape). For MANAGER, `getVisibleUserIds` returns `[self]`, matching `id: actor.id` exactly.

- [ ] **Step 2: Build and verify**

Run: `cd backend && npm run build`
Expected: 0 errors.

- [ ] **Step 3: Manual verification**

`GET /api/v1/users` as Manager, Partner, and Senior Partner — confirm the returned user lists are IDENTICAL to what they were before this change (same ids, same count) for each role, using a seeded tenant with known hierarchy (`backend/prisma/seed.ts`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/users.ts
git commit -m "Refactor users list to reuse getVisibleUserIds

Removes a hand-rolled duplicate of the same Partner/Manager
visibility rule already encoded in rbac.ts, so the two can't drift
out of sync. Behaviorally identical to the prior implementation for
all three roles."
```

---

### Task 10: Frontend — hide "Filter by owner" for Manager

**Files:**
- Modify: `frontend/src/pages/AccountsPage.tsx`
- Modify: `frontend/src/pages/ContactsPage.tsx`
- Modify: `frontend/src/pages/OpportunitiesPage.tsx`
- Modify: `frontend/src/pages/LeadsPage.tsx`
- Modify: `frontend/src/pages/PipelinePage.tsx`

**Interfaces:**
- Consumes: `useAuth()` hook from `frontend/src/hooks/useAuth` — returns an object with a `user` field carrying `orgRole`. Already imported and used in the first 4 files for the existing "Export CSV" gate (`{user?.orgRole !== "MANAGER" && (...)}`); NOT currently imported in `PipelinePage.tsx`.

- [ ] **Step 1: Gate the control in the 4 pages that already import useAuth**

In each of `AccountsPage.tsx`, `ContactsPage.tsx`, `OpportunitiesPage.tsx`, `LeadsPage.tsx`: find the `<RelationshipSelector placeholder="Filter by owner…" .../>` usage and wrap it exactly like the existing Export CSV button on the same page:
```tsx
{user?.orgRole !== "MANAGER" && (
  <RelationshipSelector placeholder="Filter by owner…" ... />
)}
```
(preserve all existing props on `RelationshipSelector` — only add the conditional wrapper, don't otherwise modify it). Reuse the same `user` variable the Export CSV gate already destructures from `useAuth()` — do not call `useAuth()` twice in the same component.

- [ ] **Step 2: Add useAuth to PipelinePage.tsx and gate the control there too**

`PipelinePage.tsx` doesn't import `useAuth` today. Add:
```tsx
import { useAuth } from "../hooks/useAuth";
```
and inside the component, `const { user } = useAuth();` (check the exact destructuring shape `useAuth` returns by looking at one of the other 4 files' usage first, to match it exactly). Then wrap this page's `<RelationshipSelector placeholder="Filter by owner…" .../>` the same way as Step 1.

- [ ] **Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: 0 errors.

Run: `grep -n "Filter by owner" frontend/src/pages/*.tsx` and confirm each of the 5 matches is now preceded by a `user?.orgRole !== "MANAGER"` guard within a few lines above it (visually check the diff, this grep alone won't prove the guard is correctly wired — read each changed hunk).

- [ ] **Step 4: Manual browser check**

Log in as `manager@crm.com` / `Password123!`: visit Accounts, Contacts, Opportunities, Leads, Pipeline — confirm "Filter by owner" is gone on all 5. Log in as `partner@crm.com` / `Password123!`: confirm it's still present on all 5, and still functions (selecting an owner filters the list).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AccountsPage.tsx frontend/src/pages/ContactsPage.tsx frontend/src/pages/OpportunitiesPage.tsx frontend/src/pages/LeadsPage.tsx frontend/src/pages/PipelinePage.tsx
git commit -m "Hide 'Filter by owner' control for Manager role

Matches the existing Export CSV gating pattern already present on
these same 5 pages. The backend already ignored this filter for
Managers (their queries are scoped to self regardless), so this was
previously a misleading UI affordance rather than a security gap."
```

---

## Final Phase 2A Verification

- [ ] Run `cd backend && npm run build` — clean.
- [ ] Run `cd frontend && npm run build` — clean.
- [ ] Full manual click-through as Manager, Partner, and Senior Partner across Leads, Quotes, Activities, Sequences, Opportunities sub-actions, Products, Audit Log, Forecasting targets, and the 5 "Filter by owner" pages, confirming each role sees exactly what the hierarchy intends.
