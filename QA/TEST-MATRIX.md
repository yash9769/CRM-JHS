# Ledger CRM — Comprehensive Test Matrix

This matrix documents all test cases across Authentication, Accounts, Contacts, Opportunities, Deals, Dashboard, API, Security, Multi-Tenancy, and User Management.

| Test ID | Category | Feature / Description | Preconditions | Expected Result | Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-001** | Authentication | Register tenant & Admin user | Valid register form input | 201 Created, JWT token returned, default pipelines seeded | **PASS** | P0 |
| **AUTH-002** | Authentication | Login with valid credentials | User exists | 200 OK, JWT token returned, user profile returned | **PASS** | P0 |
| **AUTH-003** | Authentication | Login with invalid password | User exists | 401 Unauthorized, "Invalid credentials" error | **PASS** | P1 |
| **AUTH-004** | Authentication | Access protected endpoint without token | None | 401 Unauthorized error response | **PASS** | P0 |
| **AUTH-005** | Authentication | Direct URL navigation without auth | Unauthenticated user | Redirected to `/login` | **PASS** | P1 |
| **AUTH-006** | Authentication | Logout workflow | Authenticated session | Token removed from localStorage, redirected to `/login` | **PASS** | P1 |
| **ACC-001** | Accounts | Create valid account | Authenticated Admin | 201 Created, account persisted in DB with tenantId | **PASS** | P0 |
| **ACC-002** | Accounts | Read account list with search & pagination | Accounts exist | 200 OK, paginated array, matching search results | **PASS** | P1 |
| **ACC-003** | Accounts | Read account details by ID | Account exists | 200 OK, full account object with contacts & opportunities | **PASS** | P1 |
| **ACC-004** | Accounts | Update account fields | Account exists | 200 OK, updated fields persisted in DB | **PASS** | P1 |
| **ACC-005** | Accounts | Account validation (empty name) | Invalid payload | 400 Bad Request with Zod validation details | **PASS** | P2 |
| **ACC-006** | Accounts | Account annual revenue null safety on Close Won | Account revenue null | Revenue correctly incremented from 0 to deal amount | **PASS** | P1 |
| **CON-001** | Contacts | Create valid contact linked to account | Account exists | 201 Created, contact linked via accountId | **PASS** | P0 |
| **CON-002** | Contacts | Read contact details & account relationship | Contact exists | 200 OK, account object nested in response | **PASS** | P1 |
| **CON-003** | Contacts | Contact email validation | Invalid email string | 400 Bad Request with Zod validation details | **PASS** | P2 |
| **OPP-001** | Opportunities | Fetch pipeline & stages | Default pipeline seeded | 200 OK, array of stages sorted by order | **PASS** | P1 |
| **OPP-002** | Opportunities | Create valid opportunity | Account & stage exist | 201 Created, opportunity record in DB, stage history logged | **PASS** | P0 |
| **OPP-003** | Opportunities | Convert Opportunity to Deal | Opportunity exists | 201 Created, Deal created, contacts/notes/activities linked | **PASS** | P0 |
| **OPP-004** | Opportunities | Prevent duplicate conversion | Opp already converted | 400 Bad Request, "Opportunity has already been converted" | **PASS** | P1 |
| **DEAL-001** | Deals | Add product line items to Deal | Active product exists | 201 Created, line item total computed, deal amount updated | **PASS** | P1 |
| **DEAL-002** | Deals | Mark Deal as Closed Won | Open deal | 200 OK, stage updated, wonDate set, closeDate defaulted | **PASS** | P0 |
| **DEAL-003** | Deals | Mark Deal as Closed Lost | Open deal | 200 OK, stage updated to Closed Lost, forecast category set | **PASS** | P1 |
| **DASH-001** | Dashboard | Verify KPIs & Won Revenue math | Deals closed won | 200 OK, totalPipeline, wonRevenue, winRate accurately computed | **PASS** | P0 |
| **SEC-001** | Security | Multi-tenant cross-tenant isolation | 2 Tenants created | 404 Not Found when accessing another tenant's record | **PASS** | P0 |
| **SEC-002** | Security & RBAC | Non-admin user invite restriction | Sales Rep role | 403 Forbidden when attempting user invite | **PASS** | P1 |
| **USER-001** | User Management | Delete user with owned records | User owns records | 204 No Content, records reassigned to admin, no FK 500 error | **PASS** | P1 |
| **QUOTE-001** | Quotes | Create, read, update quote | Deal & account exist | 201 Created, totals computed, status update to SENT | **PASS** | P2 |
| **REP-001** | Reports | Execute pipeline health, owner performance, win-loss | Active data in CRM | 200 OK, aggregated metrics for all 4 reports | **PASS** | P2 |
| **SEARCH-001**| Global Search | Search query across all entities | CRM records exist | 200 OK, matching accounts, contacts, opps, deals returned | **PASS** | P2 |
