/// <reference types="cypress" />
import { API_URL } from "../fixtures/crm-data";

/** Rows in a CSV export body, excluding the header line. */
const csvRowCount = (body: unknown) =>
  Math.max(0, String(body).trim().split("\n").filter((l) => l.trim().length).length - 1);

const apiGet = (token: string, path: string) =>
  cy.request({
    method: "GET",
    url: `${API_URL}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  });

/** `pagination.total` for paged lists, else the length of `data` / `results`. */
const rowCount = (body: any): number => {
  if (body?.pagination?.total !== undefined) return body.pagination.total;
  if (Array.isArray(body?.data)) return body.data.length;
  if (Array.isArray(body?.results)) return body.results.length;
  throw new Error(`Unrecognised list response shape: ${JSON.stringify(body).slice(0, 200)}`);
};

const idsOf = (body: any): string[] => (body?.data || body?.results || []).map((r: any) => r.id);

describe("API RBAC & Permissions", () => {
  describe("Manager Role Backend Restrictions", () => {
    let managerToken: string;

    beforeEach(() => {
      cy.loginAsManager().then((res) => {
        managerToken = res.token;
      });
    });

    it("Manager cannot export opportunities (returns 403)", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/opportunities/export`,
        headers: { Authorization: `Bearer ${managerToken}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
      });
    });

    it("Manager cannot export contacts (returns 403)", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/contacts/export`,
        headers: { Authorization: `Bearer ${managerToken}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
      });
    });

    it("Manager cannot view owner performance report (returns 403)", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/reports/owner-performance`,
        headers: { Authorization: `Bearer ${managerToken}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
      });
    });
  });

  describe("Partner Role Backend Permissions", () => {
    let partnerToken: string;

    beforeEach(() => {
      cy.loginAsPartner().then((res) => {
        partnerToken = res.token;
      });
    });

    it("Partner can export opportunities (returns 200)", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/opportunities/export`,
        headers: { Authorization: `Bearer ${partnerToken}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });

    it("Partner can access stage approvals queue (returns 200)", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/opportunities/approvals/pending`,
        headers: { Authorization: `Bearer ${partnerToken}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });
  });

  describe("Senior Partner Role Backend Permissions", () => {
    let seniorToken: string;

    beforeEach(() => {
      cy.loginAsSeniorPartner().then((res) => {
        seniorToken = res.token;
      });
    });

    it("Senior Partner can export contacts (returns 200)", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/contacts/export`,
        headers: { Authorization: `Bearer ${seniorToken}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });

    it("Senior Partner can view owner performance report (returns 200)", () => {
      cy.request({
        method: "GET",
        url: `${API_URL}/reports/owner-performance`,
        headers: { Authorization: `Bearer ${seniorToken}` },
      }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Per-record visibility: a Manager must be refused records outside their own
  // hierarchy, while a Senior Partner reads the same record fine.
  // ---------------------------------------------------------------------------
  describe("Per-record visibility (Manager 403 / Senior Partner 200)", () => {
    let managerToken: string;
    let seniorToken: string;
    // A record that exists in the tenant but is NOT in the manager's visibility.
    const foreign: Record<string, string> = {};
    // A record the manager legitimately owns, to prove the 403s are not blanket denials.
    const own: Record<string, string> = {};

    const SEQUENCE_NAME = "rbac-regression-foreign-sequence";

    before(() => {
      cy.loginAsManager().then((m) => {
        managerToken = m.token;
        cy.loginAsSeniorPartner().then((s) => {
          seniorToken = s.token;

          // Seed a Senior-Partner-owned sequence: the demo tenant ships with none,
          // and this suite needs one record the manager provably cannot reach.
          cy.request({
            method: "POST",
            url: `${API_URL}/sequences`,
            headers: { Authorization: `Bearer ${seniorToken}` },
            body: { name: SEQUENCE_NAME, description: "created by rbac.cy.ts" },
          }).then((res) => {
            expect(res.status).to.eq(201);
            foreign.sequences = res.body.id;
          });

          // Discover a lead and a quote visible to the Senior Partner but not the Manager.
          [
            ["leads", "/leads?pageSize=1000"],
            ["quotes", "/quotes?pageSize=1000"],
          ].forEach(([key, path]) => {
            apiGet(seniorToken, path).then((sp) => {
              apiGet(managerToken, path).then((mgr) => {
                const managerIds = new Set(idsOf(mgr.body));
                const outside = (sp.body.data || []).find((r: any) => !managerIds.has(r.id));
                expect(
                  outside,
                  `seed must contain a ${key} record outside the manager's visibility`
                ).to.exist;
                foreign[key] = outside.id;
                expect(
                  (mgr.body.data || [])[0],
                  `seed must give the manager at least one ${key} record of their own`
                ).to.exist;
                own[key] = mgr.body.data[0].id;
              });
            });
          });
        });
      });
    });

    after(() => {
      // Remove any sequence this suite created, including ones left behind by a retry.
      apiGet(seniorToken, "/sequences").then((res) => {
        (res.body.data || [])
          .filter((s: any) => s.name === SEQUENCE_NAME)
          .forEach((s: any) => {
            cy.request({
              method: "DELETE",
              url: `${API_URL}/sequences/${s.id}`,
              headers: { Authorization: `Bearer ${seniorToken}` },
              failOnStatusCode: false,
            });
          });
      });
    });

    it("Leads: Manager gets 403 on a lead outside their visibility, Senior Partner gets 200", () => {
      apiGet(managerToken, `/leads/${foreign.leads}`).then((res) => {
        expect(res.status, "manager reading another hierarchy's lead").to.eq(403);
      });
      apiGet(seniorToken, `/leads/${foreign.leads}`).then((res) => {
        expect(res.status, "senior partner reading the same lead").to.eq(200);
      });
      apiGet(managerToken, `/leads/${own.leads}`).then((res) => {
        expect(res.status, "manager reading their own lead").to.eq(200);
      });
    });

    it("Quotes: Manager gets 403 on a quote outside their visibility, Senior Partner gets 200", () => {
      apiGet(managerToken, `/quotes/${foreign.quotes}`).then((res) => {
        expect(res.status, "manager reading another hierarchy's quote").to.eq(403);
      });
      apiGet(seniorToken, `/quotes/${foreign.quotes}`).then((res) => {
        expect(res.status, "senior partner reading the same quote").to.eq(200);
      });
      apiGet(managerToken, `/quotes/${own.quotes}`).then((res) => {
        expect(res.status, "manager reading their own quote").to.eq(200);
      });
    });

    it("Sequences: Manager gets 403 on a sequence outside their visibility, Senior Partner gets 200", () => {
      apiGet(managerToken, `/sequences/${foreign.sequences}`).then((res) => {
        expect(res.status, "manager reading the senior partner's sequence").to.eq(403);
      });
      apiGet(seniorToken, `/sequences/${foreign.sequences}`).then((res) => {
        expect(res.status, "senior partner reading their own sequence").to.eq(200);
      });
    });

    it("Audit log: Manager gets 403 for records outside their visibility, Senior Partner gets 200", () => {
      const cases: [string, string][] = [
        ["LEAD", foreign.leads],
        ["QUOTE", foreign.quotes],
        ["SEQUENCE", foreign.sequences],
      ];
      cases.forEach(([objectType, recordId]) => {
        apiGet(managerToken, `/audit-log?objectType=${objectType}&recordId=${recordId}`).then((res) => {
          expect(res.status, `manager reading ${objectType} audit trail`).to.eq(403);
        });
        apiGet(seniorToken, `/audit-log?objectType=${objectType}&recordId=${recordId}`).then((res) => {
          expect(res.status, `senior partner reading ${objectType} audit trail`).to.eq(200);
        });
      });
      // The manager keeps access to the audit trail of records they do own.
      apiGet(managerToken, `/audit-log?objectType=LEAD&recordId=${own.leads}`).then((res) => {
        expect(res.status, "manager reading their own lead's audit trail").to.eq(200);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Regression coverage for the OR-key collision class of bug.
  //
  // getCreatedByFilter() returns a `where` fragment keyed on `OR`. Spreading it
  // into an object literal that also adds a literal `OR:` for an optional filter
  // (search / won / a date window) made the later key silently REPLACE the RBAC
  // restriction, so `?search=a` widened a Partner's result set to the whole
  // tenant. Every request still returned 200, so status-code assertions could
  // never catch it — these tests assert on ROW COUNTS and ID SETS instead.
  //
  // The load-bearing invariant: adding a filter must NEVER increase the number
  // of rows returned, and must never return an id the unfiltered request did not.
  // ---------------------------------------------------------------------------
  describe("RBAC filter survives optional query params (OR-collision regression)", () => {
    let managerToken: string;
    let partnerToken: string;
    let seniorToken: string;

    before(() => {
      cy.loginAsManager().then((m) => {
        managerToken = m.token;
        cy.loginAsPartner().then((p) => {
          partnerToken = p.token;
          cy.loginAsSeniorPartner().then((s) => {
            seniorToken = s.token;
          });
        });
      });
    });

    // Adding the optional filter must narrow, never widen, and never surface a
    // record the caller could not already see.
    const assertFilterOnlyNarrows = (
      tokenName: string,
      getToken: () => string,
      base: string,
      filtered: string
    ) => {
      it(`${tokenName}: ${filtered} returns a subset of ${base}`, () => {
        apiGet(getToken(), base).then((unfiltered) => {
          expect(unfiltered.status).to.eq(200);
          const baseIds = idsOf(unfiltered.body);
          const baseTotal = rowCount(unfiltered.body);

          apiGet(getToken(), filtered).then((res) => {
            expect(res.status).to.eq(200);
            const filteredTotal = rowCount(res.body);

            // The bug: the RBAC `OR` was replaced by the filter's `OR`, so the
            // filtered request returned MORE rows than the unfiltered one.
            expect(
              filteredTotal,
              `adding a query filter must not widen the result set (${base} -> ${filtered})`
            ).to.be.at.most(baseTotal);

            if (baseIds.length) {
              const visible = new Set(baseIds);
              const leaked = idsOf(res.body).filter((id) => !visible.has(id));
              expect(
                leaked,
                `filtered request returned records absent from the unfiltered request (${filtered})`
              ).to.deep.eq([]);
            }
          });
        });
      });
    };

    assertFilterOnlyNarrows("Partner", () => partnerToken, "/leads?pageSize=1000", "/leads?pageSize=1000&search=a");
    assertFilterOnlyNarrows("Manager", () => managerToken, "/leads?pageSize=1000", "/leads?pageSize=1000&search=a");
    assertFilterOnlyNarrows(
      "Partner",
      () => partnerToken,
      "/opportunities?pageSize=1000",
      "/opportunities?pageSize=1000&won=true"
    );
    assertFilterOnlyNarrows(
      "Manager",
      () => managerToken,
      "/opportunities?pageSize=1000",
      "/opportunities?pageSize=1000&won=true"
    );
    assertFilterOnlyNarrows("Partner", () => partnerToken, "/accounts?pageSize=1000", "/accounts?pageSize=1000&search=a");
    assertFilterOnlyNarrows("Partner", () => partnerToken, "/contacts?pageSize=1000", "/contacts?pageSize=1000&search=a");
    assertFilterOnlyNarrows("Partner", () => partnerToken, "/products", "/products?search=a");

    // A filtered request must still be strictly narrower for a Partner than for a
    // Senior Partner. With the collision both roles saw identical tenant-wide rows.
    const assertStillScopedUnderFilter = (label: string, path: string) => {
      it(`${label} stays scoped per role when the filter is applied (${path})`, () => {
        apiGet(partnerToken, path).then((partner) => {
          apiGet(seniorToken, path).then((senior) => {
            expect(partner.status).to.eq(200);
            expect(senior.status).to.eq(200);
            expect(
              rowCount(partner.body),
              `Partner must not see the Senior Partner's full result set for ${path}`
            ).to.be.lessThan(rowCount(senior.body));
          });
        });
      });
    };

    assertStillScopedUnderFilter("Leads", "/leads?pageSize=1000&search=a");
    assertStillScopedUnderFilter("Opportunities", "/opportunities?pageSize=1000&won=true");
    assertStillScopedUnderFilter("Accounts", "/accounts?pageSize=1000&search=a");
    assertStillScopedUnderFilter("Contacts", "/contacts?pageSize=1000&search=a");
    assertStillScopedUnderFilter("Global search", "/search?q=te&limit=20");

    // Same invariant on the CSV exports, which have no ids to compare — row counts only.
    const assertExportStaysScoped = (label: string, base: string, filtered: string) => {
      it(`${label} CSV export stays scoped with and without the filter`, () => {
        apiGet(partnerToken, base).then((partnerBase) => {
          apiGet(seniorToken, base).then((seniorBase) => {
            expect(partnerBase.status).to.eq(200);
            expect(seniorBase.status).to.eq(200);
            const partnerBaseRows = csvRowCount(partnerBase.body);
            expect(
              partnerBaseRows,
              `Partner export must be narrower than the Senior Partner's (${base})`
            ).to.be.lessThan(csvRowCount(seniorBase.body));

            apiGet(partnerToken, filtered).then((partnerFiltered) => {
              apiGet(seniorToken, filtered).then((seniorFiltered) => {
                expect(
                  csvRowCount(partnerFiltered.body),
                  `adding a query filter must not widen the export (${base} -> ${filtered})`
                ).to.be.at.most(partnerBaseRows);
                expect(
                  csvRowCount(partnerFiltered.body),
                  `Partner export must stay narrower than the Senior Partner's under a filter (${filtered})`
                ).to.be.lessThan(csvRowCount(seniorFiltered.body));
              });
            });
          });
        });
      });
    };

    assertExportStaysScoped("Leads", "/leads/export", "/leads/export?search=a");
    assertExportStaysScoped("Opportunities", "/opportunities/export", "/opportunities/export?won=true");
    assertExportStaysScoped("Accounts", "/accounts/export", "/accounts/export?search=a");
    // Contacts export previously carried no RBAC filter at all: both roles got 98/98.
    assertExportStaysScoped("Contacts", "/contacts/export", "/contacts/export?search=a");
  });

  // ---------------------------------------------------------------------------
  // Forecasting: summary totals, trend actuals and target writes must all respect
  // the caller's hierarchy.
  // ---------------------------------------------------------------------------
  describe("Forecast endpoints respect RBAC visibility", () => {
    let managerToken: string;
    let managerId: string;
    let seniorToken: string;
    let seniorId: string;

    before(() => {
      cy.loginAsManager().then((m) => {
        managerToken = m.token;
        managerId = m.user.id;
        cy.loginAsSeniorPartner().then((s) => {
          seniorToken = s.token;
          seniorId = s.user.id;
        });
      });
    });

    it("GET /forecast scopes targets, totals and the returned opportunity records", () => {
      apiGet(managerToken, "/forecast?period=2026").then((mgr) => {
        apiGet(seniorToken, "/forecast?period=2026").then((sp) => {
          expect(mgr.status).to.eq(200);
          expect(sp.status).to.eq(200);

          // The ForecastTarget query had no RBAC filter: every role saw the
          // tenant-wide target total.
          expect(mgr.body.summary.target, "manager forecast target must not be tenant-wide")
            .to.be.lessThan(sp.body.summary.target);

          // closedWon/lost were computed from a query whose RBAC `OR` had been
          // overwritten by the period-window `OR`.
          expect(mgr.body.summary.closedWon, "manager closedWon must not be tenant-wide")
            .to.be.lessThan(sp.body.summary.closedWon);

          // Whole opportunity records (name, amount, other people's owner names)
          // were returned in this array regardless of visibility.
          expect(
            mgr.body.opportunities.closedWon.length,
            "manager must not receive the tenant's full closed-won opportunity records"
          ).to.be.lessThan(sp.body.opportunities.closedWon.length);
        });
      });
    });

    it("GET /forecast/trend scopes the ACTUAL series, not just the TARGET series", () => {
      apiGet(managerToken, "/forecast/trend").then((mgr) => {
        apiGet(seniorToken, "/forecast/trend").then((sp) => {
          expect(mgr.status).to.eq(200);
          expect(sp.status).to.eq(200);
          const sum = (rows: any[], key: string) => rows.reduce((s, r) => s + r[key], 0);

          // The target series was already scoped; the actual series was not, so a
          // Manager's chart plotted a personal target against a tenant-wide actual.
          expect(sum(mgr.body.data, "target"), "manager trend target").to.be.lessThan(
            sum(sp.body.data, "target")
          );
          expect(sum(mgr.body.data, "actual"), "manager trend actual must not be tenant-wide")
            .to.be.lessThan(sum(sp.body.data, "actual"));
        });
      });
    });

    it("POST /forecast/targets rejects an ownerId outside the caller's visibility (403)", () => {
      cy.request({
        method: "POST",
        url: `${API_URL}/forecast/targets`,
        headers: { Authorization: `Bearer ${managerToken}` },
        body: { period: "2099-01", targetAmount: 1234, ownerId: seniorId },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status, "manager setting the senior partner's forecast target").to.eq(403);
      });
    });

    it("POST /forecast/targets still allows a caller to set their own target", () => {
      cy.request({
        method: "POST",
        url: `${API_URL}/forecast/targets`,
        headers: { Authorization: `Bearer ${managerToken}` },
        body: { period: "2099-02", targetAmount: 4321, ownerId: managerId },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status, "manager setting their own forecast target").to.eq(201);
        expect(res.body.ownerId).to.eq(managerId);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Duplicate detection must not become a side channel for reading PII of
  // records the caller is otherwise refused.
  // ---------------------------------------------------------------------------
  describe("Duplicate detection does not leak records outside the caller's visibility", () => {
    let managerToken: string;
    let seniorToken: string;

    before(() => {
      cy.loginAsManager().then((m) => {
        managerToken = m.token;
        cy.loginAsSeniorPartner().then((s) => {
          seniorToken = s.token;
        });
      });
    });

    it("POST /leads/check-duplicate does not return leads the Manager cannot read", () => {
      apiGet(seniorToken, "/leads?pageSize=1000").then((sp) => {
        apiGet(managerToken, "/leads?pageSize=1000").then((mgr) => {
          const managerIds = new Set(idsOf(mgr.body));
          const outside = (sp.body.data || []).find((l: any) => !managerIds.has(l.id) && l.email);
          expect(outside, "seed must contain a lead with an email outside the manager's visibility")
            .to.exist;

          // GET /leads/:id already refuses this lead...
          apiGet(managerToken, `/leads/${outside.id}`).then((direct) => {
            expect(direct.status, "direct read of the foreign lead").to.eq(403);
          });

          // ...so duplicate detection must not hand back its id/email/phone/company.
          cy.request({
            method: "POST",
            url: `${API_URL}/leads/check-duplicate`,
            headers: { Authorization: `Bearer ${managerToken}` },
            body: {
              firstName: outside.firstName,
              lastName: outside.lastName,
              email: outside.email,
            },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.eq(200);
            const leakedIds = (res.body.duplicates || []).map((d: any) => d.id);
            expect(
              leakedIds,
              "check-duplicate must not return leads outside the caller's visibility"
            ).to.not.include(outside.id);
          });
        });
      });
    });
  });
});
