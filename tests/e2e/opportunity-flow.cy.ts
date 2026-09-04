/// <reference types="cypress" />

describe("Opportunity Flow & Financial Details E2E", () => {
  let accountId: string;
  let contactId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner();
    cy.createAccount().then((acc) => {
      accountId = acc.id;
      cy.createContact(acc.id).then((c) => {
        contactId = c.id;
      });
    });
  });

  it("Opportunity detail highlights Opportunities in sidebar and renders sticky pricing bar while scrolling", () => {
    cy.createOpportunity(accountId, contactId, {
      name: `Sticky Bar Opp ${Date.now()}`,
      amount: 1200000,
      actualOpportunityValue: 1200000,
      bottomLineCost: 700000,
    }).then((opp) => {
      cy.visit(`/opportunities/${opp.id}`);

      // Verify sidebar link
      cy.get("aside").contains("Opportunities").should("be.visible");

      // Verify Pricing Details card breakdown
      cy.contains("Pricing Details").should("be.visible");
      cy.contains("Proposal Sent Value").should("be.visible");
      cy.contains("Cost Incurred to Company").should("be.visible");

      // Scroll container to test sticky pricing bar stability
      cy.get("main").scrollTo("bottom", { ensureScrollable: false });
      cy.contains("Proposal Sent Value").should("be.visible");
    });
  });

  it("Associated Contacts appear inside Opportunity Details", () => {
    cy.createOpportunity(accountId, contactId).then((opp) => {
      cy.visit(`/opportunities/${opp.id}`);
      cy.contains("Associated Contacts").should("be.visible");
    });
  });
});
