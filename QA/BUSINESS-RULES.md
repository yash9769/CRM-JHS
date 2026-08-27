# Ledger CRM — Domain Business Rules & Invariants Specifications

This document defines all core business invariants, data integrity constraints, state transition rules, and financial calculations enforced by Ledger CRM.

---

## 1. Domain Invariants & Referential Integrity

### Inv-01: Multi-Tenant Workspace Isolation
- **Rule**: Every database record (`User`, `Account`, `Contact`, `Opportunity`, `Deal`, `Quote`, `Product`, `Activity`, `Note`, `Sequence`, `Pipeline`, `PropertyDefinition`, `ForecastTarget`, `AuditLog`, `Notification`) **MUST** include a non-null `tenantId`.
- **Enforcement**: API routes filter queries by `req.authUser.tenantId`. Cross-tenant queries return HTTP 404.

### Inv-02: Account & Contact Referential Integrity
- **Rule**: Every Opportunity and Deal must belong to a valid `Account` within the user's `Tenant`.
- **Rule**: Contacts linked to an Opportunity or Deal must belong to the same `Tenant`.

### Inv-03: User Reassignment on Deletion
- **Rule**: A user cannot be deleted directly if they own records (`Account`, `Contact`, `Opportunity`, `Deal`, `Quote`, `Product`, `Activity`, `Note`, `Sequence`).
- **Enforcement**: `DELETE /api/v1/users/:id` reassigns all owned entities to the deleting Admin before removing the user record.

---

## 2. Sales Lifecycle & Stage Transitions

### Trans-01: Opportunity Creation & Progression
- **Rule**: Amount must be positive (`> 0`). Probability defaults to stage default probability (0-100%).
- **Rule**: Moving opportunity stage creates an audit record in `OpportunityStageHistory`.

### Trans-02: Opportunity to Deal Conversion
- **Rule**: When an Opportunity is converted (`POST /api/v1/opportunities/:id/convert`), a new `Deal` is created in the Deal Pipeline.
- **Rules Enforced**:
  - `Opportunity.isConverted` becomes `true`.
  - `Opportunity.convertedDealId` links to `Deal.id`.
  - Amount, Account, Contact associations, Notes, and Activities are preserved and linked to the new Deal.
  - Originating Opportunity is NEVER deleted.
  - Attempting to re-convert an already converted opportunity returns HTTP 400 Bad Request.
  - Editing a converted opportunity returns HTTP 400 Bad Request.

### Trans-03: Closed Won Deal Rules
- **Rule**: Transitioning a Deal stage to `Closed Won` (`isClosed: true, isWon: true`):
  - Requires amount to be greater than 0.
  - Defaults `closeDate` to current timestamp if omitted.
  - Sets `wonDate` to current timestamp.
  - Sets `forecastCategory` to `CLOSED_WON`.
  - Incrementally updates the linked Account's `annualRevenue` safely from `(currentRevenue || 0) + dealAmount`.
  - Generates a notification to the deal owner.

### Trans-04: Closed Lost Deal Rules
- **Rule**: Transitioning a Deal stage to `Closed Lost` (`isClosed: true, isWon: false`):
  - Sets `forecastCategory` to `CLOSED_LOST`.
  - Does NOT increase account revenue.
  - Won deal counts and won revenue calculations remain unaffected.

---

## 3. Financial Metrics & KPI Invariants

### Math-01: Dashboard KPI Calculations
- **Total Pipeline**: Sum of amounts for all open deals (`isClosed: false`).
- **Weighted Pipeline**: Sum of `amount * (probability / 100)` for all open deals.
- **Closed Won Revenue**: Sum of amounts for all closed won deals (`isClosed: true, isWon: true`).
- **Win Rate**: `Won Deals Count / (Won Deals Count + Lost Deals Count)` (0% if no closed deals).
- **Avg Deal Size**: `Closed Won Revenue / Won Deals Count` (0 if no won deals).

### Math-02: Deal Line Items & Quote Totals
- **Line Item Total**: `quantity * unitPrice * (1 - discountPct / 100) * (1 + taxPct / 100)`.
- **Deal Total**: Sum of all line item totals. Updating line items automatically re-computes `Deal.amount`.
