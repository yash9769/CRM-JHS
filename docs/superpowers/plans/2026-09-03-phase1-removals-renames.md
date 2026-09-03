# Phase 1 — Removals & Renames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Log Activity creation feature, apply four label/field renames, and remove three UI elements (page subtitles, opportunity-detail stage stepper, contact-detail opportunities list) — all without breaking any currently-working functionality.

**Architecture:** Frontend-only for most tasks (React/TypeScript, Vite). One task touches the Prisma schema + a DB migration + backend routes for the deal→opportunity field rename. No new dependencies.

**Tech Stack:** React 19, TypeScript, Vite, Fastify, Prisma, PostgreSQL.

## Global Constraints

- Every table query must keep filtering by `tenantId` — untouched by this plan, but no task may remove that filtering incidentally.
- Currency display stays `en-IN` / ₹ — untouched by this plan.
- `backend/prisma/schema.prisma` primary keys are `String @id @default(uuid())` — the migration in Task 4 is a column rename only, no PK changes.
- Run `npm run build` in both `backend` and `frontend` after each task that touches TypeScript — this repo has no unit test suite for these components, so a clean `tsc -b` build (which fails on any leftover reference to a renamed/removed field) is the primary automated safety net, backed by manual verification in the browser.

---

### Task 1: Remove Log Activity creation feature (frontend only)

**Correction vs. the design spec:** the backend `POST /api/v1/activities` route must **stay** — it's also used by Timeline's "Create task" tab (`logTask` mutation, `type: "TASK"`), which is a separate feature we are keeping. Only the **"Log activity" tab UI** inside Timeline and the standalone `LogActivityModal` go away.

**Files:**
- Modify: `frontend/src/components/Timeline.tsx` — remove the "log" tab entirely (keep "note" and "task" tabs)
- Modify: `frontend/src/components/CreateModals.tsx:1099-1143` — delete `LOGGABLE_TYPES` const and `LogActivityModal` function
- Modify: `frontend/src/components/QuickCreate.tsx` — remove the "Log Activity" quick-create entry
- Modify: `frontend/src/pages/AccountDetailPage.tsx` — remove "Log Activity" button + modal render
- Modify: `frontend/src/pages/ContactDetailPage.tsx:130` — remove "Log Activity" modal render (button removal happens as part of Task 8, which deletes this whole section — but do it here too in case Task 8's boundary shifts)
- Modify: `frontend/src/pages/LeadDetailPage.tsx` — remove "Log Activity" button + modal render
- Modify: `frontend/src/pages/OpportunityDetailPage.tsx` — remove "Log Activity" button + modal render + import

**Interfaces:**
- Produces: `Timeline` component's public props (`activities`, `notes`, `assoc`, `queryKeysToInvalidate`) are unchanged — only its internal tab set shrinks from `"log" | "note" | "task"` to `"note" | "task"`.

- [ ] **Step 1: Remove the "log" tab from Timeline**

In `frontend/src/components/Timeline.tsx`:
- Change the tab union type from `useState<"log" | "note" | "task">("log")` to `useState<"note" | "task">("note")`.
- Change the tabs array from `(["log", "note", "task"] as const)` to `(["note", "task"] as const)`.
- Update the label ternary `t === "log" ? "Log activity" : t === "note" ? "Add note" : "Create task"` to `t === "note" ? "Add note" : "Create task"`.
- Delete the `logActivity` mutation and the `type` state (`useState<Activity["type"]>("CALL")`) — both only served the log tab.
- Delete the entire `{tab === "log" && (...)}` block (the type-select/subject/body/"Log" button form).
- The `Activity` import stays (still used by `TimelineEvent`/`activityIcons`/`ev.activity.type` for rendering history).

- [ ] **Step 2: Delete LogActivityModal**

In `frontend/src/components/CreateModals.tsx`, delete lines 1099-1143 (the `LOGGABLE_TYPES` const and the whole `LogActivityModal` function). Check the top-of-file export list / re-exports for `LogActivityModal` and remove any reference there too.

- [ ] **Step 3: Remove Log Activity from Quick Create**

In `frontend/src/components/QuickCreate.tsx`:
- Remove `LogActivityModal` from the `CreateModals` import.
- Remove `PhoneCall` from the lucide-react import if it becomes unused after this change (check no other icon usage remains in the file first).
- Remove the `{ kind: "activity", label: "Log Activity", icon: PhoneCall }` entry from `items`.
- Remove `"activity"` from the `Kind` type union.
- Remove the `{active === "activity" && <LogActivityModal onClose={() => setActive(null)} />}` render line.

- [ ] **Step 4: Remove Log Activity button + modal from AccountDetailPage**

In `frontend/src/pages/AccountDetailPage.tsx`:
- Remove the `<Button variant="secondary" onClick={() => setModal("log")}><PhoneCall size={14} /> Log Activity</Button>` button (currently at line 56).
- Remove the `{modal === "log" && <LogActivityModal .../>}` render line (currently at line 207).
- Remove `LogActivityModal` from the `CreateModals` import; remove `PhoneCall` from the lucide-react import if now unused in this file.

- [ ] **Step 5: Remove Log Activity modal render from ContactDetailPage**

In `frontend/src/pages/ContactDetailPage.tsx`, remove line 130 (`{modal === "log" && <LogActivityModal .../>}`) and the `LogActivityModal` import. (There's no separate "Log Activity" button on this page today — only the modal render — confirm during this step whether a button exists elsewhere and remove it if so.)

- [ ] **Step 6: Remove Log Activity button + modal from LeadDetailPage**

In `frontend/src/pages/LeadDetailPage.tsx`, remove the button that sets `showLog`, the `{showLog && <LogActivityModal .../>}` render (currently line 277), the `showLog` state itself if now unused, and the `LogActivityModal` import.

- [ ] **Step 7: Remove Log Activity button + modal from OpportunityDetailPage**

In `frontend/src/pages/OpportunityDetailPage.tsx`, remove the button that opens the log modal, the `<LogActivityModal .../>` render (currently around line 795), and `LogActivityModal` from the `CreateModals` import on line 9.

- [ ] **Step 8: Build and verify**

Run: `cd frontend && npm run build`
Expected: builds clean (0 errors). This will surface any leftover reference to `LogActivityModal`, `LOGGABLE_TYPES`, or the removed `tab === "log"` branch.

Run: `grep -rn "LogActivityModal\|LOGGABLE_TYPES" frontend/src`
Expected: no matches.

- [ ] **Step 9: Manual browser check**

Start the app (`npm run dev` in both `backend` and `frontend`), and confirm:
- Account, Contact, Lead, and Opportunity detail pages no longer show a "Log Activity" button.
- Quick Create (⌘K) menu no longer lists "Log Activity".
- Each detail page's Timeline/Activity panel still shows "Add note" and "Create task" tabs, notes can still be added, tasks can still be created, and past activity history still renders.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/Timeline.tsx frontend/src/components/CreateModals.tsx frontend/src/components/QuickCreate.tsx frontend/src/pages/AccountDetailPage.tsx frontend/src/pages/ContactDetailPage.tsx frontend/src/pages/LeadDetailPage.tsx frontend/src/pages/OpportunityDetailPage.tsx
git commit -m "Remove Log Activity creation feature

Removes the standalone LogActivityModal and Timeline's inline
log tab across Account/Contact/Lead/Opportunity detail pages and
Quick Create. Notes and task creation (which share the same
backend endpoint) are untouched, and past activity history still
displays.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Dashboard label rename — "Cost Incurred" → "Cost Incurred to Company"

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:** none (pure string literal change).

- [ ] **Step 1: Find and replace the label**

Run: `grep -n "Cost Incurred" frontend/src/pages/DashboardPage.tsx`

Replace every occurrence of the exact string `"Cost Incurred"` with `"Cost Incurred to Company"` in `frontend/src/pages/DashboardPage.tsx`. If the label is split across JSX (e.g. `Cost Incurred{suffix}`), adjust the surrounding JSX so the rendered text reads exactly "Cost Incurred to Company" with no double spacing.

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: builds clean.

- [ ] **Step 3: Manual browser check**

Open the Dashboard page, confirm the label now reads "Cost Incurred to Company" wherever it previously read "Cost Incurred".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "Rename dashboard label to 'Cost Incurred to Company'

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: "deal" → "opportunity" — Prisma schema, migration, and backend

**Files:**
- Modify: `backend/prisma/schema.prisma` (Opportunity model, currently around line 348-362)
- Create: a Prisma migration (via `prisma migrate dev`)
- Modify: `backend/src/routes/opportunities.ts`
- Modify: `backend/src/routes/dashboard.ts`
- Modify: `backend/src/routes/approvals.ts`
- Modify: `backend/src/lib/financial.ts`
- Modify: `backend/src/routes/auth.ts` (only if it references these fields directly, e.g. in a seed/onboarding path — confirm with `grep -n "expectedDealValue\|actualDealValue\|dealType" backend/src/routes/auth.ts` first)
- Modify: `backend/src/scripts/removeOpportunityStage.ts` if it references these fields

**Interfaces:**
- Produces: Opportunity records now expose `expectedOpportunityValue`, `actualOpportunityValue` (both `Decimal? @db.Decimal(16,2)`), and `opportunityType` renamed to... **do not rename `dealType`'s destination to `opportunityType`** — that name is already taken by an existing, distinct field (`opportunityType: "NEW_BUSINESS" | "EXPANSION" | "RENEWAL"` in `frontend/src/lib/types.ts:210`, also present in the Prisma schema). Rename `dealType` to `dealTypeLegacy`... **no** — resolve this properly: before writing any code, run `grep -n "dealType\b" backend/prisma/schema.prisma backend/src -r` and `grep -n "opportunityType\b" backend/prisma/schema.prisma backend/src -r` to see how each is actually used (created/read/written) in the backend, and read `frontend/src/pages/OpportunityDetailPage.tsx` around the `opp.dealType || opp.opportunityType` fallback (line ~364) to understand why both exist. If `dealType` turns out to be genuinely dead/unused legacy data, rename it to `opportunityTypeLegacy` and flag it to the user for a follow-up decision on whether to drop it entirely; if it's actively used for something `opportunityType` doesn't cover, rename it to a specific descriptive name (e.g. `dealCategory`) instead of "opportunityType" to avoid the collision, and confirm the choice with the user before running the migration. **Do not proceed with the migration step until this collision is resolved** — everything else in this task can be scaffolded first.
- `expectedDealValue` → `expectedOpportunityValue`, `actualDealValue` → `actualOpportunityValue` have no naming collisions and can proceed directly.

- [ ] **Step 1: Resolve the dealType/opportunityType naming collision**

Run: `grep -n "dealType" backend/src -r frontend/src -r` and read every call site. Determine the correct new name per the Interfaces note above. Confirm with the user if there's any ambiguity about whether `dealType` is legacy/dead data.

- [ ] **Step 2: Rename columns in the Prisma schema**

In `backend/prisma/schema.prisma`, rename:
- `expectedDealValue` → `expectedOpportunityValue`
- `actualDealValue` → `actualOpportunityValue`
- `dealType` → (name decided in Step 1)

- [ ] **Step 3: Generate and apply the migration**

Run: `cd backend && npx prisma migrate dev --name rename_deal_fields_to_opportunity`
Expected: Prisma detects this as a rename (not drop+create) if you answer its interactive rename-detection prompt correctly — watch the CLI output carefully and confirm it offers "renamed" options for these three columns rather than "deleted + created" (which would drop data). If it doesn't offer a rename option, stop and handle it as an explicit `ALTER TABLE ... RENAME COLUMN` migration instead so no data is lost.

- [ ] **Step 4: Update backend route references**

Run: `grep -rn "expectedDealValue\|actualDealValue\|dealType" backend/src` and update every match in `opportunities.ts`, `dashboard.ts`, `approvals.ts`, `financial.ts`, and any other file the grep surfaces, to the new field names from Step 1-2.

- [ ] **Step 5: Regenerate Prisma client and build**

Run: `cd backend && npm run prisma:generate && npm run build`
Expected: builds clean — TypeScript will fail on any remaining old field name since the Prisma client's generated types will no longer have them.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src
git commit -m "Rename deal fields to opportunity in schema and backend

expectedDealValue -> expectedOpportunityValue, actualDealValue ->
actualOpportunityValue, dealType -> <resolved name>. Data-preserving
column rename migration.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: "deal" → "opportunity" — frontend field renames

Depends on Task 3 (needs the new backend field names to match).

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/financial.ts`
- Modify: `frontend/src/components/Kanban.tsx`
- Modify: `frontend/src/components/EditModals.tsx`
- Modify: `frontend/src/components/CreateModals.tsx`
- Modify: `frontend/src/pages/OpportunitiesPage.tsx`
- Modify: `frontend/src/pages/OpportunityDetailPage.tsx`
- Modify: `frontend/src/pages/AccountDetailPage.tsx`
- Modify: `frontend/src/components/ClosedWonModal.tsx`
- Modify: `frontend/src/components/HistoryPanel.tsx`
- (ContactDetailPage.tsx's `o.expectedDealValue`/`o.actualDealValue` usage at lines 84-85 is removed by Task 8, not renamed here — skip it in this task.)

**Interfaces:**
- Consumes: field names from Task 3 (`expectedOpportunityValue`, `actualOpportunityValue`, and the resolved third name).

- [ ] **Step 1: Rename in types.ts**

In `frontend/src/lib/types.ts`, rename `expectedDealValue` → `expectedOpportunityValue`, `actualDealValue` → `actualOpportunityValue`, `dealType` → (resolved name) on the `Opportunity` interface (currently lines 185-186, 206).

- [ ] **Step 2: Rename in financial.ts**

In `frontend/src/lib/financial.ts`, rename every `expectedDealValue`/`actualDealValue` reference (input type, local variables, computed fields) to the new names. Keep the exported computed-field shape's *other* keys (`bottomLineCost`, `expectedMargin`, `grossMargin`, etc.) unchanged — only the two deal-value fields rename.

- [ ] **Step 3: Rename remaining frontend usages**

Run: `grep -rln "expectedDealValue\|actualDealValue\|dealType" frontend/src` and update each file in the list (`Kanban.tsx`, `EditModals.tsx`, `CreateModals.tsx`, `OpportunitiesPage.tsx`, `OpportunityDetailPage.tsx`, `AccountDetailPage.tsx`, `ClosedWonModal.tsx`, `HistoryPanel.tsx`) to use the new field names, including in `TRACKED_FIELDS` array in `HistoryPanel.tsx`.

- [ ] **Step 4: Build and verify**

Run: `cd frontend && npm run build`
Expected: builds clean.

Run: `grep -rn "expectedDealValue\|actualDealValue" frontend/src backend/src`
Expected: no matches outside of ContactDetailPage.tsx (handled in Task 8) and CSV import synonym strings (handled in Task 5).

- [ ] **Step 5: Manual browser check**

Create a new opportunity, edit an existing one's proposal value, view it in the pipeline Kanban and in the Opportunities table — confirm values still display and save correctly under the new field names.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "Rename deal fields to opportunity in frontend

Matches the backend rename from the previous commit:
expectedDealValue -> expectedOpportunityValue, actualDealValue ->
actualOpportunityValue.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: "deal" → "opportunity" — user-facing text and CSV import

Depends on Task 4.

**Files:**
- Modify: `frontend/src/components/ApprovalReviewModal.tsx`
- Modify: `frontend/src/components/ClosedWonModal.tsx`
- Modify: `frontend/src/pages/OpportunityDetailPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/OpportunitiesPage.tsx`
- Modify: `frontend/src/pages/PipelinePage.tsx`
- Modify: `frontend/src/components/CsvImportModal.tsx`
- Modify: `frontend/src/components/RelationshipSelector.tsx` (comment only)

**Interfaces:** none (string literal changes only).

- [ ] **Step 1: Update visible labels**

Make these exact replacements:
- `ApprovalReviewModal.tsx:116` "Deal Value" → "Opportunity Value"
- `ApprovalReviewModal.tsx:178` comment "Closed Won Deal Details" → "Closed Won Opportunity Details"
- `ClosedWonModal.tsx:103` "Deal Close Requirements" → "Opportunity Close Requirements"
- `ClosedWonModal.tsx:212` placeholder "Add any additional notes about this deal closure…" → "…this opportunity closure…"
- `OpportunityDetailPage.tsx:328` "Expected Deal Value" → "Expected Opportunity Value"
- `OpportunityDetailPage.tsx:362` "Deal Type" → (label matching the Task 3 resolved field name)
- `DashboardPage.tsx:155` "Review All Deals" → "Review All Opportunities"
- `PipelinePage.tsx:103` placeholder "Search pipeline deals…" → "Search pipeline opportunities…"
- `PipelinePage.tsx:124` "Loading pipeline deals…" → "Loading pipeline opportunities…"

- [ ] **Step 2: Update CSV import labels, keep old synonyms for backwards import compatibility**

In `frontend/src/components/CsvImportModal.tsx`:
- Change export column header labels "Expected Deal Value" → "Expected Opportunity Value", "Actual Deal Value" → "Actual Opportunity Value" (lines ~51-52).
- Change the field `label` values (lines ~74-77) to "Opportunity Value"-style wording.
- **Keep** the existing `synonyms` arrays as-is (e.g. `"deal name"`, `"deal value"`, `"deal amount"`) so previously-exported CSVs with old headers still import correctly — synonyms are input-matching aliases, not display text.

- [ ] **Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: builds clean.

Run: `grep -rin "\bdeal\b" frontend/src backend/src`
Expected: only remaining matches are inside `CsvImportModal.tsx`'s `synonyms` arrays (intentionally kept) and `RelationshipSelector.tsx`'s doc comment (update that comment too, it's not user-facing but keep it accurate — replace "Deal" with "Opportunity" there as well since there's no reason to keep it stale).

- [ ] **Step 4: Manual browser check**

Walk through: Opportunity detail page labels, dashboard "Review All Opportunities" link, Pipeline page search placeholder, CSV export column headers, CSV import still accepting a file with old "Deal Value" column headers.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "Rename remaining deal->opportunity user-facing text

CSV import synonyms intentionally keep old 'deal' aliases so
previously-exported files still import correctly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: "Financial Details" → "Pricing Details"

**Files:**
- Modify: `frontend/src/components/EditModals.tsx:362`
- Modify: `frontend/src/components/CreateModals.tsx:530`

**Interfaces:** none (string literal change).

- [ ] **Step 1: Replace the heading text**

In both files, change `<h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-800)]">Financial Details</h4>` to use the text "Pricing Details" instead of "Financial Details".

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: builds clean.

Run: `grep -rn "Financial Details" frontend/src`
Expected: no matches.

- [ ] **Step 3: Manual browser check**

Open the Create Opportunity and Edit Opportunity modals, confirm the section heading now reads "Pricing Details".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/EditModals.tsx frontend/src/components/CreateModals.tsx
git commit -m "Rename 'Financial Details' section heading to 'Pricing Details'

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Remove page subtitles

**Files:**
- Modify: `frontend/src/pages/OpportunitiesPage.tsx:134`
- Modify: `frontend/src/pages/AccountsPage.tsx:67`
- Modify: `frontend/src/pages/ContactsPage.tsx:63`
- Modify: `frontend/src/pages/DashboardPage.tsx:82`
- Modify: `frontend/src/pages/ForecastingPage.tsx:82`
- Modify: `frontend/src/pages/LeadsPage.tsx:71`
- Modify: `frontend/src/pages/PipelinePage.tsx:75`
- Modify: `frontend/src/pages/ProductsPage.tsx:373`
- Modify: `frontend/src/pages/QuotesPage.tsx:177`
- Modify: `frontend/src/pages/ReportsPage.tsx:191`
- Modify: `frontend/src/pages/SequencesPage.tsx:167`
- Modify: `frontend/src/pages/ServicesPage.tsx:191`
- Modify: `frontend/src/pages/SettingsPage.tsx:33`
- Modify: `frontend/src/pages/TasksPage.tsx:76`

**Interfaces:**
- Consumes: `PageHeader`'s `subtitle` prop must remain optional in `frontend/src/components/ui.tsx` (do not remove the prop from the component itself — just stop passing it from these 14 call sites, in case a future page still wants one).

**Not in scope:** `EmptyState` subtitles (e.g. "Create your first account to start tracking a customer.") — those are functional zero-state guidance, not the page-level description this task removes.

- [ ] **Step 1: Remove the subtitle prop from each PageHeader call**

For each file/line listed above, remove the `subtitle="..."` attribute from the `<PageHeader title="..." subtitle="...">` call (leaving `title` and any other props intact). Do not touch `EmptyState` components' `subtitle` props anywhere.

- [ ] **Step 2: Build and verify**

Run: `cd frontend && npm run build`
Expected: builds clean.

Run: `grep -n "subtitle=" frontend/src/pages/*.tsx`
Expected: only matches remaining are `EmptyState` usages, not `PageHeader` usages.

- [ ] **Step 3: Manual browser check**

Visit all 14 pages, confirm no description line appears under the page title, and confirm empty-state messages (e.g. on a freshly-filtered Accounts page with zero results) are unaffected.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages
git commit -m "Remove page-level description subtitles

Empty-state guidance text is untouched — only the top-of-page
description under each PageHeader title is removed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Remove pipeline stage-arrow visual + opportunities list from Contact Detail

Grouping these two together since both are small, single-file removals in the same area of the app.

**Files:**
- Modify: `frontend/src/pages/OpportunityDetailPage.tsx` (remove `Stepper` function and its render)
- Modify: `frontend/src/pages/ContactDetailPage.tsx` (remove opportunities list section)

**Interfaces:** none — the stage-change `<select>` dropdown that stays already calls the existing `handleStageSelect` function, unchanged.

- [ ] **Step 1: Remove the Stepper component**

In `frontend/src/pages/OpportunityDetailPage.tsx`:
- Delete the `Stepper` function (lines 24-67).
- Delete its render call (`<Stepper stages={...} currentStageId={...} onSelectStage={...} />`, currently lines 288-292), but **keep** the surrounding `<Card className="p-4">...</Card>` wrapper and the `<select>` dropdown + "Change Opportunity Stage to:" label that follow it (lines 293-309) — those provide the actual stage-change functionality.
- Remove the now-unused `ArrowRight` and `CheckCircle2` imports from `lucide-react` if nothing else in the file uses them (check with `grep -n "ArrowRight\|CheckCircle2" frontend/src/pages/OpportunityDetailPage.tsx` first).

- [ ] **Step 2: Remove opportunities list from Contact Detail**

In `frontend/src/pages/ContactDetailPage.tsx`, delete the `<div className="mt-6">...</div>` block (lines 69-98) that renders the "Opportunities" heading and the list of `contact.opportunityContacts`. Leave the "Contact information" card content above it and the "Activity"/Timeline card beside it untouched.

- [ ] **Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: builds clean.

- [ ] **Step 4: Manual browser check**

Open an opportunity detail page: confirm the stage-pill/arrow row is gone but the "Change Opportunity Stage to:" dropdown still works (select a different stage, confirm it saves). Open a contact detail page that has associated opportunities: confirm the "Opportunities" section no longer appears, and the Contact info + Activity timeline still render correctly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/OpportunityDetailPage.tsx frontend/src/pages/ContactDetailPage.tsx
git commit -m "Remove pipeline stepper visual and contact-detail opportunities list

Opportunity detail: removed the stage-pill/arrow stepper; the
existing stage-change dropdown provides the same functionality.
Contact detail: removed the list of associated opportunities.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final Phase 1 Verification

- [ ] Run `cd backend && npm run build` — clean.
- [ ] Run `cd frontend && npm run build` — clean.
- [ ] Run `grep -rn "LogActivityModal\|LOGGABLE_TYPES\|Financial Details" frontend/src` — no matches.
- [ ] Run `grep -rin "\bdeal\b" frontend/src backend/src` — only CSV import synonym arrays remain.
- [ ] Full manual click-through of all 7 items in a running dev server (both `npm run dev` processes), covering every page touched above.
