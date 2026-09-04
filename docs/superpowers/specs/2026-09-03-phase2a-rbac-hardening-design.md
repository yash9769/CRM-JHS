# Phase 2A — RBAC Hardening

Part of the larger 22-item change list, covering items #16 and #18 (item #12,
search scoping, is confirmed already correct — no work needed). Follows
Phase 1 (removals & renames, merged). Phase 2B (approval workflow +
confirm-dialog UX) is a separate spec.

## Background

`backend/src/lib/rbac.ts` already implements the correct visibility
hierarchy (Manager sees only self, Partner sees self + their Managers via
`partnerId`, Senior Partner sees all) via `getVisibleUserIds`,
`getCreatedByFilter`, and `requireCanAccess`. An audit found it's applied
inconsistently — some routes use it correctly (`opportunities.ts` list,
`search.ts`, `dashboard.ts`, `reports.ts`, `accounts.ts`/`contacts.ts` core
CRUD), while several route files have **no record-level RBAC at all**,
meaning any Manager can currently view/edit/delete any record of that type
tenant-wide, not just their own.

## Backend fixes

### 1. Leads — most severe gap (`backend/src/routes/leads.ts`)

`requireCanAccess` is never imported. Fix:
- Import `getCreatedByFilter`, `requireCanAccess` from `../lib/rbac.js`.
- `GET /leads/export`: add `...(await getCreatedByFilter(req.authUser))` to
  the `where` clause (currently tenant-only), matching the pattern already
  used on `GET /leads`.
- `GET /leads/:id`, `PATCH /leads/:id`, `DELETE /leads/:id`,
  `POST /leads/:id/archive`, `POST /leads/:id/convert`: after fetching the
  record (or before, whichever fits each handler's existing structure),
  call `await requireCanAccess(req.authUser, record)` and let it throw its
  403 — wrap in the route's existing error handling if any, otherwise let
  Fastify's central error handler catch it (confirm `app.ts` maps a thrown
  `err.statusCode` correctly — it already does per `rbac.ts`'s docblock
  contract).
- `POST /leads/bulk`: after loading the target leads by `id in body.ids`,
  filter out (or 403 on) any lead not in `getVisibleUserIds(req.authUser)`
  — do not silently drop them from the bulk op without telling the caller;
  return which ids were skipped due to permission, or reject the whole
  request with a clear error listing them (implementer's choice, whichever
  fits the existing bulk-response shape — document the choice in the PR).

### 2. Quotes — most complete gap (`backend/src/routes/quotes.ts`)

Zero record-level RBAC anywhere despite `Quote` having an `ownerId` field.
Fix:
- Import `getCreatedByFilter`, `requireCanAccess` from `../lib/rbac.js`
  (file already imports `requireExportPermission`).
- `GET /quotes` (list) and `GET /quotes/export`: add the rbacFilter to
  `where`.
- `GET /quotes/:id`, `PATCH /quotes/:id`, `DELETE /quotes/:id`,
  `GET /quotes/:id/pdf`, `POST /quotes/:id/duplicate`: add
  `requireCanAccess` after loading the record.

### 3. Activities & Notes (`backend/src/routes/activities.ts`)

`Activity` has `ownerId`; `Note` — check its schema for an owner/author
field (`authorId` per `frontend/src/lib/types.ts`'s `Note.author`) and use
whichever field the model actually has for the RBAC check. Fix:
- Import `getCreatedByFilter`, `requireCanAccess`.
- `GET /activities` (list) and `GET /activities/export`: add rbacFilter.
- `PATCH /activities/:id`: add `requireCanAccess`.
- `POST /notes` doesn't need a visibility check (create), but
  `PATCH /notes/:id` and `DELETE /notes/:id` need `requireCanAccess` keyed
  on the note's author field.

### 4. Sequences (`backend/src/routes/sequences.ts`)

`rbac.ts` isn't imported at all despite `Sequence.ownerId` existing. Fix:
- Import `getCreatedByFilter`, `requireCanAccess`.
- `GET /sequences` (list): add rbacFilter.
- `GET /sequences/:id`, `PATCH /sequences/:id`, `DELETE /sequences/:id`,
  and the steps/enroll/enrollments sub-routes that load a sequence by id:
  add `requireCanAccess` after loading the parent sequence (sub-routes
  operating on steps/enrollments should check the parent sequence's
  visibility, not attempt their own separate ownership model).

### 5. Opportunities sub-route gaps (`backend/src/routes/opportunities.ts`)

Core list/GET/PATCH already correct. Fix the remaining gaps:
- `GET /opportunities/export`: add rbacFilter (currently tenant-only,
  inconsistent with the list endpoint one function above it).
- `DELETE /opportunities/:id`: add `requireCanAccess` (inconsistent with
  accounts/contacts DELETE, which already check).
- `POST /:id/archive`, `POST /:id/attachments`,
  `DELETE /:id/attachments/:attachmentId`, `POST /:id/line-items`,
  `DELETE /:id/line-items/:lineItemId` (or however line-item deletion is
  routed — confirm exact route name): add `requireCanAccess` after loading
  the parent opportunity.
- `POST /opportunities/bulk`: same treatment as leads bulk (item 1) —
  filter/reject ids outside `getVisibleUserIds`.

### 6. Products (`backend/src/routes/products.ts`)

- `PATCH /products/:id`: add `requireCanAccess` (not currently imported in
  this file for this purpose).
- Remove the no-op ad-hoc role check at products.ts:60-67 that hard-codes
  `["SENIOR_PARTNER","PARTNER","MANAGER"]` (all three roles — the check
  currently does nothing). If there was a real intended restriction there
  (e.g. only Partner+ can edit `unitPrice`), confirm with a fresh look at
  git blame/history before removing outright — if the intent is genuinely
  unclear, leave a comment explaining it's dead code rather than silently
  deleting a rule that might have been meant to be stricter. Default to
  removal if no evidence of intended stricter behavior is found.

### 7. Audit history exploitable gap (`backend/src/routes/auditHistory.ts`)

Currently: `requireCanAccess` only runs when `objectType === "OPPORTUNITY"
&& recordId`. The visible-user-ids restriction only applies when
`!recordId`. This means `GET /audit-log?objectType=LEAD&recordId=<any-id>`
(or ACCOUNT, CONTACT, QUOTE, ACTIVITY, etc.) bypasses RBAC entirely — any
tenant user can read the audit trail for any record of any non-Opportunity
type. Fix: extend the per-record `requireCanAccess` check to run for
every `objectType` when `recordId` is present, not just `OPPORTUNITY` —
load the underlying record (by the appropriate model per `objectType`) and
check visibility the same way the Opportunity branch does. If a given
`objectType` doesn't have an obvious "owner" field to check (e.g. reference
data), fall back to tenant-only for that type specifically and note it in
the PR — but Lead, Account, Contact, Quote, Activity all have an owner and
must be checked.

### 8. Forecasting targets (`backend/src/routes/forecasting.ts`)

- `GET /forecast/targets`: add rbacFilter (currently returns all tenant
  `ForecastTarget` rows; the model has `ownerId`).
- `GET /forecast/trend`: the `forecastTarget.aggregate` call (around line
  190-193) needs the same rbacFilter applied that the opportunity queries
  in this file already use — currently pulls tenant-wide targets into the
  trend line regardless of caller visibility.

### 9. Users list refactor (`backend/src/routes/users.ts`)

`GET /users` (lines 40-57) hand-rolls the same Partner/Manager visibility
rule `getVisibleUserIds` already encodes. Refactor to:
```ts
const visibleIds = await getVisibleUserIds(actor);
const where = { tenantId: actor.tenantId, id: { in: visibleIds } };
```
removing the duplicated inline `if/else` — this must produce IDENTICAL
results to the current logic for all three roles (verify: Senior Partner
unrestricted either way since `getVisibleUserIds` returns all tenant user
ids for SP and `where` only adds `id: {in: allIds}`, functionally a no-op
tenant-only filter — confirm this matches current behavior exactly, not
an accidental behavior change).

## Frontend fix — "Filter by owner" gating (item #16)

Currently shown unconditionally to all roles on 5 pages. Hide it for
Manager, matching the existing "Export CSV" button gating pattern already
present on the same pages:
```tsx
{user?.orgRole !== "MANAGER" && (
  <RelationshipSelector placeholder="Filter by owner…" .../>
)}
```
Files: `frontend/src/pages/AccountsPage.tsx`,
`frontend/src/pages/ContactsPage.tsx`,
`frontend/src/pages/OpportunitiesPage.tsx`,
`frontend/src/pages/LeadsPage.tsx` (all four already import `useAuth`
for the Export CSV gate — reuse the same `user` variable), and
`frontend/src/pages/PipelinePage.tsx` (does NOT currently import
`useAuth` — add the import and hook call).

## Out of scope for 2A

- `approvals.ts` — covered by Phase 2B (approval eligibility + stage
  extension), not touched here.
- `savedViews.ts`, `stickyNotes.ts`, `notifications.ts` — already correct
  by design (always self-scoped), no changes.
- `services.ts` — tenant-wide reference data, no owner concept, no changes.
- `dashboard.ts`, `reports.ts`, `search.ts` — already correct, no changes
  (reports.ts's ad-hoc inline Manager-block on `owner-performance` is a
  distinct, already-correct rule with no gap — not touched).

## Testing

- No unit test suite for these routes exists. Verification is:
  `cd backend && npm run build` clean, plus for each fixed endpoint, a
  manual/scripted check (e.g. `curl` with a Manager JWT vs a Partner JWT
  against the same record) confirming the Manager gets 403/empty and the
  Partner/Senior Partner succeeds appropriately. Where the existing Cypress
  suite already has coverage touching these routes, run the relevant specs.
- Manual browser walkthrough: log in as `manager@crm.com` and confirm the
  "Filter by owner" control is gone from all 5 pages; log in as
  `partner@crm.com` and confirm it's still there.
