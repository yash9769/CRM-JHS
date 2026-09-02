/// <reference types="cypress" />
import { API_URL } from "../fixtures/crm-data";

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
});
