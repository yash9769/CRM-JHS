# Ledger CRM — REST API Endpoint Inventory & Validation Document

This document lists all discovered Fastify REST API routes, authentication requirement, request validation schemas, expected HTTP status codes, and database effects.

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/register`
- **Auth Required**: No
- **Payload Schema**: `{ companyName: string, firstName: string, lastName: string, email: string (email format), password: string (min 8) }`
- **Expected Status**: `201 Created`
- **Response**: `{ token, user: { id, email, firstName, lastName, role }, tenant: { id, name } }`
- **Database Effect**: Creates `Tenant`, initial `User` (Role `ADMIN`), seeds default Opportunity `Pipeline` + 7 stages and default Deal `Pipeline` + 5 stages.

### `POST /api/v1/auth/login`
- **Auth Required**: No
- **Payload Schema**: `{ email: string, password: string }`
- **Expected Status**: `200 OK` (or `401 Unauthorized` for invalid credentials)
- **Response**: `{ token, user: { id, email, firstName, lastName, role } }`

### `GET /api/v1/auth/me`
- **Auth Required**: Yes (`Bearer JWT`)
- **Expected Status**: `200 OK` (or `401 Unauthorized`)
- **Response**: `{ user: {...}, tenant: {...} }`

---

## 2. Accounts Endpoints

### `GET /api/v1/accounts`
- **Auth Required**: Yes
- **Query Parameters**: `page`, `pageSize`, `search`, `accountType`, `ownerId`, `sortBy`, `sortDir`
- **Expected Status**: `200 OK`
- **Response**: `{ data: Account[], pagination: { page, pageSize, total, totalPages } }`

### `POST /api/v1/accounts`
- **Auth Required**: Yes
- **Payload Schema**: `{ name: string (min 1), domain?, industry?, employeeCount?, annualRevenue?, ownerId?, accountType?, phone?, website?, description? }`
- **Expected Status**: `201 Created` (or `400 Bad Request` on validation error)
- **Database Effect**: Inserts `Account` record bound to `req.authUser.tenantId`.

### `GET /api/v1/accounts/:id`
- **Auth Required**: Yes
- **Expected Status**: `200 OK` (or `404 Not Found`)

### `PATCH /api/v1/accounts/:id`
- **Auth Required**: Yes
- **Expected Status**: `200 OK` (or `404 Not Found`)

### `DELETE /api/v1/accounts/:id`
- **Auth Required**: Yes
- **Expected Status**: `204 No Content` (or `404 Not Found`)

---

## 3. Contacts Endpoints

### `GET /api/v1/contacts`
- **Auth Required**: Yes
- **Query Parameters**: `page`, `pageSize`, `search`, `accountId`, `ownerId`
- **Expected Status**: `200 OK`

### `POST /api/v1/contacts`
- **Auth Required**: Yes
- **Payload Schema**: `{ firstName: string (min 1), lastName: string (min 1), email?: string (email format), phone?, jobTitle?, lifecycleStage?, accountId? }`
- **Expected Status**: `201 Created` (or `400 Bad Request`)

---

## 4. Opportunities Endpoints

### `GET /api/v1/opportunities`
- **Auth Required**: Yes
- **Expected Status**: `200 OK`

### `POST /api/v1/opportunities`
- **Auth Required**: Yes
- **Payload Schema**: `{ name: string (min 1), accountId: uuid, amount: positive number, pipelineId: uuid, stageId: uuid, ownerId: uuid, contactIds?: uuid[] }`
- **Expected Status**: `201 Created`

### `POST /api/v1/opportunities/:id/convert`
- **Auth Required**: Yes
- **Payload Schema**: `{ dealPipelineId: uuid, dealStageId: uuid, closeDate?: ISO date string }`
- **Expected Status**: `201 Created` (or `400 Bad Request` if already converted)
- **Database Effect**: Creates `Deal`, links account/contacts/notes/activities, sets `isConverted = true` on `Opportunity`.

---

## 5. Deals Endpoints

### `GET /api/v1/deals`
- **Auth Required**: Yes
- **Expected Status**: `200 OK`

### `POST /api/v1/deals`
- **Auth Required**: Yes
- **Expected Status**: `201 Created`

### `PATCH /api/v1/deals/:id`
- **Auth Required**: Yes
- **Expected Status**: `200 OK`
- **Business Logic Enforced**: On transition to Closed Won stage, populates `wonDate`, defaults `closeDate` to current date if missing, and safely increments linked account's `annualRevenue`.

---

## 6. Dashboard & Analytics Endpoints

### `GET /api/v1/dashboard`
- **Auth Required**: Yes
- **Expected Status**: `200 OK`
- **Response Structure**:
  ```json
  {
    "kpis": {
      "totalPipeline": number,
      "weightedPipeline": number,
      "openOpportunities": number,
      "openDeals": number,
      "closedWonRevenue": number,
      "winRate": number,
      "avgDealSize": number,
      "dealsClosingThisMonth": number
    },
    "charts": {
      "pipelineByStage": [],
      "revenueByMonth": [],
      "dealsByOwner": []
    }
  }
  ```
