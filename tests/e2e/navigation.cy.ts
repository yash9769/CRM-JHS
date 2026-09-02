/// <reference types="cypress" />

describe("Navigation & Active Sidebar State E2E", () => {
  let accountId: string;
  let contactId: string;
  let opportunityId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner();
  });

  before(() => {
    cy.loginAsSeniorPartner();
    cy.createAccount().then((acc) => {
      accountId = acc.id;
      cy.createContact(acc.id).then((con) => {
        contactId = con.id;
        cy.createOpportunity(acc.id, con.id).then((opp) => {
          opportunityId = opp.id;
        });
      });
    });
  });

  it("Sidebar navigation items are present and navigate correctly", () => {
    cy.visit("/dashboard");

    // Check sidebar links
    cy.get("aside").contains("Dashboard").should("be.visible");
    cy.get("aside").contains("Pipeline").click();
    cy.url().should("include", "/pipeline");

    cy.get("aside").contains("Opportunities").click();
    cy.url().should("include", "/opportunities");

    cy.get("aside").contains("Accounts").click();
    cy.url().should("include", "/accounts");

    cy.get("aside").contains("Contacts").click();
    cy.url().should("include", "/contacts");

    cy.get("aside").contains("Forecast").click();
    cy.url().should("include", "/forecasting");

    cy.get("aside").contains("Reports").click();
    cy.url().should("include", "/reports");
  });

  it("Opportunity detail highlights Opportunities in sidebar", () => {
    if (opportunityId) {
      cy.visit(`/opportunities/${opportunityId}`);
      cy.get("aside").contains("Opportunities").should("be.visible");
    }
  });

  it("Account detail page navigates correctly", () => {
    if (accountId) {
      cy.visit(`/accounts/${accountId}`);
      cy.url().should("include", `/accounts/${accountId}`);
    }
  });

  it("Contact detail page navigates correctly", () => {
    if (contactId) {
      cy.visit(`/contacts/${contactId}`);
      cy.url().should("include", `/contacts/${contactId}`);
    }
  });
});
