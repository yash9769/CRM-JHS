# Ledger CRM — Role-Based Access Control (RBAC) Security Matrix

This document defines the Role-Based Access Control (RBAC) structure and enforcement matrix across all user roles (`ADMIN`, `SALES_MANAGER`, `SALES_REP`, `VIEWER`) and API endpoints in **Ledger CRM**.

---

## 1. Role Definitions

- **`ADMIN`**: Complete administrative control over tenant settings, user invitations, role assignments, user deletions, and all CRM resources.
- **`SALES_MANAGER`**: Can invite new team members (`SALES_REP` and `VIEWER`) and manage all sales records, pipelines, targets, and reports. Cannot modify user roles to `ADMIN` or delete user accounts.
- **`SALES_REP`**: Standard operational user. Can perform CRUD on CRM records (Accounts, Contacts, Opportunities, Deals, Quotes, Line Items, Activities, Notes). Cannot invite users, change roles, or delete users.
- **`VIEWER`**: Read-only user. Has access to view accounts, contacts, pipelines, deals, reports, and dashboards.

---

## 2. API Endpoint RBAC Enforcement Matrix

| Endpoint | Method | Action / Resource | ADMIN | SALES_MANAGER | SALES_REP | VIEWER | Server-Side Enforcement Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `/api/v1/auth/register` | POST | Register Tenant & Admin | ✅ | ✅ | ✅ | ✅ | Public endpoint |
| `/api/v1/auth/login` | POST | Authenticate User | ✅ | ✅ | ✅ | ✅ | Public endpoint |
| `/api/v1/auth/me` | GET | Read Current Profile | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/users` | GET | List Tenant Users | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/users/invite` | POST | Invite Team Member | ✅ Allowed | ✅ Allowed | ❌ Forbidden (403) | ❌ Forbidden (403) | **Enforced** (Role Check) |
| `/api/v1/users/:id` | PATCH | Update Profile / Self | ✅ Allowed | Self Only | Self Only | Self Only | **Enforced** (Self/Admin Check) |
| `/api/v1/users/:id` | PATCH | Change User Role | ✅ Allowed | ❌ Forbidden (403) | ❌ Forbidden (403) | ❌ Forbidden (403) | **Enforced** (Admin Check) |
| `/api/v1/users/:id` | DELETE | Delete User & Reassign | ✅ Allowed | ❌ Forbidden (403) | ❌ Forbidden (403) | ❌ Forbidden (403) | **Enforced** (Admin Check) |
| `/api/v1/accounts` | GET | List Accounts | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/accounts` | POST | Create Account | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/accounts/:id` | GET | Read Account | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/accounts/:id` | PATCH | Update Account | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/accounts/:id` | DELETE | Delete Account | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/contacts` | GET/POST | Read/Create Contact | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/opportunities` | GET/POST | Read/Create Opportunity | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/opportunities/:id/convert`| POST | Convert to Deal | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/deals` | GET/POST | Read/Create Deal | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/deals/:id` | PATCH | Update Deal / Closed Won | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/quotes` | GET/POST/PATCH | Quotes Lifecycle | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/products` | GET/POST | Products Catalog | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/reports/*` | GET | Analytics Reports | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |
| `/api/v1/dashboard` | GET | Dashboard KPIs | ✅ | ✅ | ✅ | ✅ | `app.authenticate` |

---

## 3. Key Findings & Security Observations

1. **User Administration Endpoint Isolation**:
   - `POST /api/v1/users/invite` correctly returns HTTP 403 Forbidden when invoked by a `SALES_REP` or `VIEWER`.
   - `PATCH /api/v1/users/:id` correctly blocks non-Admins from changing roles or editing other users' profiles.
   - `DELETE /api/v1/users/:id` correctly restricts user deletion and record reassignment to `ADMIN` users only.
2. **Tenant Isolation Consistency**:
   - Every single data route filters database operations with `where: { tenantId: req.authUser.tenantId }`.
   - Attempting to query, update, or delete any entity belonging to another tenant returns HTTP 404 Not Found (or 403), preventing IDOR across tenants.
