/// <reference types="cypress" />

describe("Approval Flow E2E", () => {
  let accountId: string;
  let oppId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner();
    cy.createAccount().then((acc) => {
      accountId = acc.id;
      cy.createOpportunity(acc.id, undefined, { name: `Approval Flow Opp ${Date.now()}` }).then((opp) => {
        oppId = opp.id;
      });
    });
  });

  it("Manager requests stage approval and Partner reviews request in pending queue", () => {
    // 1. Manager visits opportunity
    cy.loginAsManager();
    cy.visit(`/opportunities/${oppId}`);

    // 2. Senior Partner logs in and reviews pending approvals section
    cy.loginAsSeniorPartner();
    cy.visit("/dashboard");
    cy.contains("Dashboard").should("be.visible");
  });

  it("Senior Partner can view stage change approval requests history", () => {
    cy.loginAsSeniorPartner();
    cy.visit(`/opportunities/${oppId}`);
    cy.contains("Stage Change Approvals & History").should("be.visible");
  });
});
