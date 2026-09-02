/// <reference types="cypress" />

describe("Closed Lost Workflow E2E", () => {
  let accountId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner();
    cy.createAccount().then((acc) => {
      accountId = acc.id;
    });
  });

  it("Closed Lost requires mandatory loss reason", () => {
    cy.createOpportunity(accountId, undefined, { name: `Closed Lost Test Opp ${Date.now()}` }).then((opp) => {
      cy.visit(`/opportunities/${opp.id}`);
      cy.get("button").contains("Closed Lost").click();

      cy.contains("Closed Lost Reason Required").should("be.visible");

      // Enter lost reason in textarea
      cy.get('textarea[placeholder*="Budget constraints"]').type("Competitor offered lower pricing");
      cy.contains("button", "Confirm Closed Lost").click();

      cy.contains("Closed Lost").should("be.visible");
    });
  });
});
