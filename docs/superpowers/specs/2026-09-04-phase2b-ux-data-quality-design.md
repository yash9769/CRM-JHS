# Phase 2B — UX & Data Quality Fixes

Part of the 22/23-item change list. Covers items 3, 5, 6, 8, 10, 11, 13, 14,
15, 19, 20. Item 7 (merge Reports + Forecast into Dashboard with graphics +
PDF export) is deliberately excluded — it's the largest single item and gets
its own dedicated phase (2C) immediately after this one, per user direction
to prioritize it early but not block these smaller fixes on it.

## 3. Approval requests: replace table with list + revoke

- `ApprovalQueueTable.tsx` currently renders a `<table>`. Replace with a
  simple list of cards, one per request: opportunity/account name, stage
  transition, value, requester, age.
- Add a "Revoke" action, calling the existing (already implemented, unused)
  `POST /api/v1/opportunities/approvals/:id/cancel` endpoint. Per user
  decision: visible/enabled only when `requestedById === current user.id`
  AND `status === "PENDING"`. No other role can revoke.
- `StageApprovalsWidget.tsx` (dropdown widget) stays list-style as-is, but
  gets the same revoke action for consistency.

## 5. Contact linking — cap at 5, fix display

- Backend already accepts `contactIds: string[]` on Opportunity create/edit
  — no schema change needed, just add `.max(5)` to the zod array for a hard
  cap, with a clear 400 error message.
- Frontend `RelationshipSelector` is single-select only in both
  `CreateModals.tsx` and `EditModals.tsx`. Change to a multi-select that
  lets the user add up to 5 contacts, each removable, with the 6th add
  attempt blocked in the UI (not just at submit).
- `OpportunityDetailPage.tsx` "Associated Contacts" section already lists
  `opp.contact` + `opp.contacts` — verify it renders correctly once the
  create/edit flow can actually produce more than one.
- Accounts: check `AccountDetailPage.tsx` contacts tab for the same
  1-contact-add limitation and apply the same fix if present.

## 6. Column drag-and-drop + saved view

- `SavedView` model/route already supports a `columns: string[]` field,
  currently unused by the frontend (`SavedViewsBar.tsx` only persists
  `filters`). Add column order to what gets saved/loaded.
- Add drag handles to column headers (or the `ColumnFilter` dropdown rows)
  using native HTML5 drag-and-drop (no new dependency) to reorder, then
  persist the order via `SavedViewsBar`'s existing save flow.
- Per user decision: per-user (not shared/global) — already the case since
  `SavedView` is scoped to the requesting user via existing auth.

## 8. Approval pending/approved counts

- No aggregate endpoint exists. Add `GET /api/v1/opportunities/approvals/counts`
  returning `{ pending, approved }` via `prisma.stageApproval.groupBy`.
- Surface on `ApprovalQueueTable.tsx` page header and/or Dashboard as two
  small stat tiles.

## 10 & 11. Pipeline Kanban card fields + created date

- `Kanban.tsx` card JSX currently shows Opportunity Value (actual/expected)
  and Gross Margin. Fetched-but-unused fields already exist on `KanbanItem`
  (`bottomLineCost`, `marginLoss`) — add to the card: Proposal Value, Cost
  Incurred to Company, Margin Value, Margin % (replacing Gross Margin, not
  alongside it).
- Add Created Date to every card (currently only Close Date shows) — must
  render correctly across all stage columns, not just some.

## 13. Field validation hardening

- Phone: allow international formats (user decision) — replace the current
  `^\d+$`-only regex (and the missing regex on `leads.ts`) with a shared
  validator accepting `+`, digits, spaces, hyphens, parens, 7–15 digits
  total (E.164-ish, permissive). Apply consistently across
  `opportunities.ts`, `contacts.ts`, `leads.ts` (currently has none) and
  their frontend counterparts.
- Name fields: currently only `.min(1)` (any single character, including
  symbols/digits, passes). Tighten to require at least 2 letters (allow
  spaces, hyphens, apostrophes for real names) across contacts/leads.
- Monetary fields: backend already uses `.nonnegative()` on Opportunity
  values — audit `leads.ts` and `accounts.ts` for the same gap and fix.
  Frontend `type="number" min="0"` doesn't hard-block negative entry in all
  cases (paste, some browsers) — add an explicit check on submit.

## 14. Search bars

- Explore agent found all page search inputs are already functionally
  wired. No changes planned here unless manual testing turns up a
  regression — treat as verify-only, not implement.

## 15. Open Opportunities stage filter + column order

- `OpportunitiesPage.tsx` "Open" tab currently filters by `!stage.isClosed`
  (any non-closed stage). Change to filter specifically to stages: Scope
  Discussion, Proposal Sent, Negotiation. Per user decision, earlier-stage
  opportunities (New/Qualification) remain visible in the full table/Kanban
  — only excluded from this "Open" tab.
- Move "Assigned To" column from its current position to right after
  "Opportunity Name" in both the `OPPORTUNITY_COLUMNS` config and the table
  header/body JSX.

## 19. Back button on all pages

- No existing back-button component. Add a small shared `BackButton`
  (uses `lucide-react` `ArrowLeft`, calls `navigate(-1)`) to `ui.tsx`, and
  place it on all detail pages (Opportunity/Account/Contact/Lead) plus list
  pages where useful for consistent UX.

## 20. Forecast target card — total target

- `ForecastingPage.tsx` per-stat cards are scoped to the selected
  period/rep; there's no aggregate "total target" figure shown. Add a
  "Total Target" stat card summing targets across the current view scope.

---

## Testing
- `npm run build` clean in both `backend` and `frontend` after each task.
- Manual verification via seeded accounts (Manager/Partner/Senior Partner)
  where RBAC-adjacent (item 3 revoke, item 6 per-user views).
