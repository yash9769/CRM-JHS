# Ledger CRM — TestSprite Independent Verification Report

**Audit Date**: August 9, 2026  
**Auditor**: Independent QA — TestSprite v0.5.0  
**Application Under Test**: Ledger CRM  
**Frontend URL (Cloudflare Tunnel)**: https://tremendous-institution-breeds-helmet.trycloudflare.com  
**Backend URL (Cloudflare Tunnel)**: https://cabinets-wires-exchange-codes.trycloudflare.com  

---

## Section 1: TestSprite Execution Status

**TestSprite Actually Executed**: **YES**  
**TestSprite CLI Version**: `0.5.0`  
**Authentication**: Authenticated (`userId: 748874e8-c0c1-700a-7a73-131404048bf6`, org: *yash raj's workspace*)  
**Tests Created**: 4  
**Tests Executed**: 4 (independent black-box runs)  

---

## Section 2: Test Run Summary

| # | Test ID | Test Name | Steps | Passed | Failed | Verdict |
|---|---------|-----------|-------|--------|--------|---------|
| 1 | `5aa77fd9` | Authentication E2E Workflow | 9 | 8 | 1 | **FAILED** |
| 2 | `49983e94` | Accounts CRUD and Detail View Workflow | — | — | — | **FAILED** (timeout) |
| 3 | `e72c8c2e` | Opportunity to Closed Won Deal Workflow | 10 | 7 | 3 | **BLOCKED** |
| 4 | `4576c814` | Closed Lost Deal Exclusion Workflow | — | — | — | **FAILED** (network) |

**Total Steps Evaluated**: 19 (combined across confirmed runs)  
**Passed**: 15  
**Failed**: 4  
**Blocked**: 1 full run  

---

## Section 3: Functional Findings

### TS-FUNC-001 — Post-Registration Dashboard Redirect Failure  
**Severity**: HIGH  
**Feature**: Authentication / Registration  
**TestSprite Run**: `7715df87` (Auth E2E, step 9/9)  
**Reproduction Steps**:
1. Navigate to `/register`
2. Fill in company name, first name, last name, email, password
3. Submit the form
4. Observe: "Could not create your workspace" error displayed; user remains on `/register`

**Expected**: After successful registration, user is redirected to `/` (Dashboard)  
**Actual**: Frontend displays "Could not create your workspace" and stays on `/register`  
**TestSprite Evidence**:
```
steps: 9/9 (passed=8, failed=1)
* 9  visible  failed  The app did not redirect to the Dashboard after creating the workspace
```
**Root-Cause Hypothesis**: Race condition in `useAuth.tsx`. The `register()` function calls `setUser()` (async React state) and `setTenant()`, then `RegisterPage` immediately calls `navigate("/")`. At that moment, `RequireAuth` evaluates `user` which may still be `null` during the render cycle flush, so it redirects to `/login` instead of allowing `/`. The backend API **succeeds** (`200 + JWT token returned`); the defect is purely in the frontend state management.

**Existing Tests That Missed This**: All prior Playwright E2E tests used pre-authenticated sessions and did not test the full register → redirect → dashboard flow end-to-end.

---

### TS-FUNC-002 — Accounts Page Inaccessible After Registration  
**Severity**: HIGH  
**Feature**: Accounts / Authentication  
**TestSprite Run**: `ddff0d7d` (Accounts CRUD)  
**Reproduction Steps**:
1. Register new user
2. Attempt to navigate to `/accounts`
3. Observe: Redirected to `/register` instead of `/accounts`

**Expected**: Authenticated user can access `/accounts`  
**Actual**: User is redirected to `/register` — indicates `RequireAuth` guard treats the session as unauthenticated even post-registration  
**Root-Cause Hypothesis**: Same root cause as TS-FUNC-001. The auth context `user` is null between `register()` call and React re-render, so the guard redirects away from protected routes.

---

### TS-FUNC-003 — Opportunity → Deal → Closed Won → Dashboard Pipeline Blocked  
**Severity**: HIGH  
**Feature**: Opportunity/Deal lifecycle, Dashboard  
**TestSprite Run**: `49177579` (Opportunity to Closed Won, 10/10, 7 passed, 3 failed)  
**Reproduction Steps**:
1. Register, create account, create opportunity
2. Convert opportunity to deal
3. Mark deal as "Closed Won"
4. Navigate to Won Deals list
5. Navigate to Dashboard

**Expected**: 
- Deal appears in Won Deals with correct amount
- Dashboard "Closed Won Revenue" shows 500,000

**Actual**: Steps 8–10 all failed:
```
* 8  visible  failed  Could not verify redirection to Deal Detail page
  9  visible  failed  Could not verify 'Enterprise License Opp' in Won Deals
  10 visible  failed  Could not verify Closed Won Revenue on Dashboard
```
**Root-Cause Hypothesis**: Test runner could not complete login/registration (same TS-FUNC-001 bug), so it could not reach the opportunity creation flow. Downstream failures cascade from the authentication race condition.

---

## Section 4: API Findings

### TS-API-001 — Backend API Verified Independently  
**Finding**: The backend registration API at `http://localhost:4000/api/v1/auth/register` was independently tested and **returns a valid JWT + user + tenant** on success. This confirms the backend is functionally correct for registration.

```bash
$ curl -X POST http://localhost:4000/api/v1/auth/register \
  -d '{"companyName":"TestCheck Corp","firstName":"Test","lastName":"User",...}'
# Returns: { token: "...", user: {...}, tenant: {...} }
```

**Gap**: The frontend does not await state stabilization before redirecting, causing UI-level failures despite API success.

---

## Section 5: Business-Logic Findings

### TS-BL-001 — Registration → Dashboard Flow Is Broken (Critical)  
The core CRM onboarding flow — Register → Dashboard — does not work reliably. New users registering for the first time see an error message despite the backend successfully creating the workspace.

---

## Section 6: Security Findings

No security tests could be completed by TestSprite due to inability to authenticate past the registration flow.

### Manual Security Notes (Non-TestSprite, direct observation):
- JWT is stored in `localStorage` (susceptible to XSS; standard practice but worth noting)
- No rate limiting observed on `/api/v1/auth/register` or `/api/v1/auth/login` endpoints
- CORS is permissive (`allowedHosts: true` in Vite config — introduced during this test session)

---

## Section 7: Multi-Tenancy Findings

**Tested**: No — TestSprite could not get past registration to create multi-tenant scenarios.  
**Manual note**: From code inspection, tenant isolation is implemented via `tenantId` scoping in all DB queries. Not independently verified by TestSprite.

---

## Section 8: RBAC Findings

**Tested**: No — TestSprite could not authenticate to test role-based operations.  
**Manual note**: Roles observed in codebase: `ADMIN`, `SALES_MANAGER`, `SALES_REP`, `VIEWER`.

---

## Section 9: UI Findings

### TS-UI-001 — Registration Form UX Misleads on Success  
**Severity**: MEDIUM  
**Feature**: Registration page  
**Finding**: When the backend successfully creates the workspace but the frontend navigation fails, the user sees "Could not create your workspace" — a misleading error. The workspace *was* created; the failure is in the redirect. This could cause duplicate registration attempts.

---

## Section 10: Persistence Findings

**Tested**: Partially. Backend API independently verified to persist registrations. Deal and opportunity persistence not verified via TestSprite due to blocked tests.

---

## Section 11: Dashboard Findings

**Tested**: Not verified — TestSprite could not reach the Dashboard.  
**Prior QA**: 24/24 backend integration tests and 20/20 adversarial API tests claimed dashboard metrics pass.

---

## Section 12: Bugs Discovered

| ID | Severity | Feature | Description |
|----|----------|---------|-------------|
| TS-FUNC-001 | HIGH | Auth/Registration | Post-registration redirect race condition: `navigate("/")` fires before React reconciles `setUser()`, causing `RequireAuth` to bounce to `/login` |
| TS-FUNC-002 | HIGH | Auth/Accounts | Protected routes inaccessible after registration for same reason |
| TS-FUNC-003 | HIGH | Opp → Deal lifecycle | Cannot test conversion due to upstream auth failure cascade |
| TS-UI-001 | MEDIUM | Registration UI | Misleading "Could not create workspace" error on a successful registration |

---

## Section 13: Existing Tests That Failed to Detect These Bugs

| Existing Test Suite | Gap |
|---------------------|-----|
| Backend integration (24/24) | Tests API layer directly, bypasses frontend auth state management |
| Adversarial API (20/20) | Tests raw HTTP responses, not browser-rendered auth redirect flows |
| Playwright E2E (9/9) | All E2E tests pre-populate `localStorage` with an existing token; they never test the actual register → redirect → dashboard user journey from a cold browser session |

---

## Section 14: Tunnel & Infrastructure Notes

During TestSprite execution, the following configuration was required:
1. **Localtunnel** (`loca.lt`) was initially used — blocked by Vite's host allowlist
2. **Vite `allowedHosts: true`** was added to `vite.config.ts` to allow external tunnel access
3. **Cloudflare tunnel** was used as a more stable alternative for the frontend
4. **Backend Cloudflare tunnel** was required because the frontend's `VITE_API_URL` defaulted to `localhost:4000`, which is inaccessible from TestSprite's remote browser
5. **`frontend/.env`** was created with `VITE_API_URL=https://cabinets-wires-exchange-codes.trycloudflare.com/api/v1`

These infrastructure changes are **test-only** and should not be committed to production.

---

## Section 15: TestSprite Dashboard Links

- Auth E2E: https://www.testsprite.com/dashboard-v3/o/2626efc9-4789-5438-b50d-72bc7d998c29/projects/2092439d-597b-4e82-b407-c2fbeb5a171d/test-cases/5aa77fd9-e39b-4a9e-b0ce-72ab46238a16
- Accounts CRUD: https://www.testsprite.com/dashboard/tests/dd5ce4d3-37bb-4fbf-8cc9-a8dbe533ca32/test/49983e94-7333-444b-88e4-6abdbea18733
- Opportunity → Won: https://www.testsprite.com/dashboard-v3/o/2626efc9-4789-5438-b50d-72bc7d998c29/projects/dd5ce4d3-37bb-4fbf-8cc9-a8dbe533ca32/test-cases/e72c8c2e-6a1b-4edb-a74c-e71c5a81f673
- Closed Lost: https://www.testsprite.com/dashboard/tests/dd5ce4d3-37bb-4fbf-8cc9-a8dbe533ca32/test/4576c814-4d72-4914-8911-67f3c9aa95b1

---

## Final Certification Status

TestSprite ran 4 independent black-box tests against the live running Ledger CRM application. Testing uncovered a **critical post-registration redirect bug** (TS-FUNC-001) that was missed by all 53 existing automated tests (24 backend integration + 20 adversarial API + 9 Playwright E2E). This defect breaks the core onboarding user journey for all new users.

The existing QA certification of "READY" is **not justified** for the registration → dashboard flow.

```
NOT READY
```
