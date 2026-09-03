# Phase 1 — Removals & Renames

Part of a larger 22-item change list. This phase covers the mechanical
removals/renames; RBAC, validation, per-page UX fixes, and the
dashboard/reports/forecast merge are separate later phases.

## 1. Remove "Log Activity" feature (creation only; Notes/history stays)

Two independent implementations exist and both must go:

- `LogActivityModal` component in [CreateModals.tsx](frontend/src/components/CreateModals.tsx) — delete the component.
- Its imports/usages + trigger buttons in:
  - [AccountDetailPage.tsx](frontend/src/pages/AccountDetailPage.tsx) — "Log Activity" button + modal render
  - [ContactDetailPage.tsx](frontend/src/pages/ContactDetailPage.tsx) — same
  - [LeadDetailPage.tsx](frontend/src/pages/LeadDetailPage.tsx) — same
  - [OpportunityDetailPage.tsx](frontend/src/pages/OpportunityDetailPage.tsx) — same
  - [QuickCreate.tsx](frontend/src/components/QuickCreate.tsx) — "Log Activity" quick-create entry
- The separate inline "Log" mini-form built into [Timeline.tsx](frontend/src/components/Timeline.tsx) (its own `logActivity` mutation posting to `/activities`, plus the type-select/subject/body/"Log" button UI) — remove this form, keep the rest of Timeline (notes, task creation, and read-only display of past activity history) intact.
- **Correction:** `POST /api/v1/activities` in [activities.ts](backend/src/routes/activities.ts) must **stay** — Timeline's "Create task" tab also posts to this same endpoint (with `type: "TASK"`), which is a separate feature we're keeping. No backend changes are needed for this item at all.

## 2. Dashboard label rename

"Cost Incurred" → "Cost Incurred to Company" in [DashboardPage.tsx](frontend/src/pages/DashboardPage.tsx).

## 3. "deal" → "opportunity" — full rename incl. DB (per your answer: everything, not just UI text)

This is the highest-risk item in this phase because it changes DB column
names. Plan:

- **Prisma schema** [schema.prisma](backend/prisma/schema.prisma): rename columns `expectedDealValue`→`expectedOpportunityValue`, `actualDealValue`→`actualOpportunityValue`, `dealType`→`opportunityType` (note: `opportunityType` already exists as a separate field per [OpportunityDetailPage.tsx:364](frontend/src/pages/OpportunityDetailPage.tsx:364) showing `opp.dealType || opp.opportunityType` — I'll confirm these aren't meant to be merged, and keep them distinct fields with `dealType` simply renamed, unless they should actually collapse into one field).
- **Migration**: `prisma migrate dev` renaming columns (data-preserving rename, not drop+add).
- **Backend**: update all references in [opportunities.ts](backend/src/routes/opportunities.ts), [dashboard.ts](backend/src/routes/dashboard.ts), [approvals.ts](backend/src/routes/approvals.ts), [financial.ts](backend/src/lib/financial.ts), [auth.ts](backend/src/routes/auth.ts) (import/seed refs).
- **Frontend**: rename the same fields throughout — [types.ts](frontend/src/lib/types.ts), [financial.ts](frontend/src/lib/financial.ts), [Kanban.tsx](frontend/src/components/Kanban.tsx), [EditModals.tsx](frontend/src/components/EditModals.tsx), [CreateModals.tsx](frontend/src/components/CreateModals.tsx), [OpportunitiesPage.tsx](frontend/src/pages/OpportunitiesPage.tsx), [OpportunityDetailPage.tsx](frontend/src/pages/OpportunityDetailPage.tsx), [ContactDetailPage.tsx](frontend/src/pages/ContactDetailPage.tsx), [AccountDetailPage.tsx](frontend/src/pages/AccountDetailPage.tsx), [ClosedWonModal.tsx](frontend/src/components/ClosedWonModal.tsx), [CsvImportModal.tsx](frontend/src/components/CsvImportModal.tsx), [HistoryPanel.tsx](frontend/src/components/HistoryPanel.tsx), [PipelinePage.tsx](frontend/src/pages/PipelinePage.tsx), [RelationshipSelector.tsx](frontend/src/components/RelationshipSelector.tsx).
- **User-facing text**: "Deal Value"→"Opportunity Value", "Review All Deals"→"Review All Opportunities", "Deal Close Requirements"→"Opportunity Close Requirements", "Deal Type"→"Opportunity Type", CSV import column labels/synonyms, placeholder copy ("Search pipeline deals…" etc.).
- **CSV import backwards compat**: existing synonyms list already accepts "deal value"/"deal amount" as import aliases — keep those as accepted synonyms (so old exported CSVs still import) even though the canonical field/label is now "opportunity".

## 4. "Financial Details" → "Pricing Details"

Section headings in [EditModals.tsx](frontend/src/components/EditModals.tsx) and [CreateModals.tsx](frontend/src/components/CreateModals.tsx).

## 5. Remove page descriptions

Remove the `subtitle` line under the page title (via `<PageHeader title=".." subtitle="..">`) on all pages that have one — 13 pages: [OpportunitiesPage.tsx:134](frontend/src/pages/OpportunitiesPage.tsx:134), [AccountsPage.tsx:67](frontend/src/pages/AccountsPage.tsx:67), [ContactsPage.tsx:63](frontend/src/pages/ContactsPage.tsx:63), [DashboardPage.tsx:82](frontend/src/pages/DashboardPage.tsx:82), [ForecastingPage.tsx:82](frontend/src/pages/ForecastingPage.tsx:82), [LeadsPage.tsx:71](frontend/src/pages/LeadsPage.tsx:71), [PipelinePage.tsx:75](frontend/src/pages/PipelinePage.tsx:75), [ProductsPage.tsx:373](frontend/src/pages/ProductsPage.tsx:373), [QuotesPage.tsx:177](frontend/src/pages/QuotesPage.tsx:177), [ReportsPage.tsx:191](frontend/src/pages/ReportsPage.tsx:191), [SequencesPage.tsx:167](frontend/src/pages/SequencesPage.tsx:167), [ServicesPage.tsx:191](frontend/src/pages/ServicesPage.tsx:191), [SettingsPage.tsx:33](frontend/src/pages/SettingsPage.tsx:33), [TasksPage.tsx:76](frontend/src/pages/TasksPage.tsx:76).

**Not** touching `EmptyState` subtitles (e.g. "Create your first account to start tracking a customer.") — those are functional empty-state guidance shown when a list has zero rows, not the page-level description this item refers to. Will confirm scope holds if it turns out you meant those too.

## 6. Remove pipeline stage-arrow visual on Opportunity Detail

Remove the `Stepper` component (the row of numbered stage pills connected by arrows) at [OpportunityDetailPage.tsx:24-67](frontend/src/pages/OpportunityDetailPage.tsx:24) and its render at [line 288](frontend/src/pages/OpportunityDetailPage.tsx:288). The `<select>` dropdown just below it (["Change Opportunity Stage to:"](frontend/src/pages/OpportunityDetailPage.tsx:294)) already provides the same stage-change functionality and stays — so no functionality is lost, only the visual stepper.

## 7. Remove opportunities list from Contact Detail page

Remove the opportunities-associated-with-this-contact list/section in [ContactDetailPage.tsx](frontend/src/pages/ContactDetailPage.tsx) (includes the deal-value display at lines 84-85 noted above, which goes away with the whole section).

---

## Testing

- Manual verification in the browser: Log Activity buttons gone from all 4 detail pages + quick create, Timeline notes still work, dashboard label updated, deal→opportunity rename doesn't break opportunity create/edit/CSV import/pipeline drag-drop, financial→pricing heading updated, page subtitles gone, stepper gone but stage-change dropdown still works, contact detail no longer shows opportunities.
- Run `npm run build` in both `backend` and `frontend` to catch any leftover references to renamed fields (TypeScript will surface these).
