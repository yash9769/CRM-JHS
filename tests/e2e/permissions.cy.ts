/// <reference types="cypress" />

describe("RBAC UI & Feature Permissions E2E", () => {
  it("Manager cannot export opportunities or contacts", () => {
    cy.loginAsManager();
    
    cy.visit("/opportunities");
    cy.contains("Export CSV").should("not.exist");

    cy.visit("/contacts");
    cy.contains("Export CSV").should("not.exist");
  });

  it("Manager cannot view Owner Performance tab in Reports", () => {
    cy.loginAsManager();

    cy.visit("/reports");
    cy.contains("Owner Performance").should("not.exist");
  });

  it("Senior Partner can view Owner Performance in Reports", () => {
    cy.loginAsSeniorPartner();

    cy.visit("/reports");
    cy.contains("Owner Performance").should("be.visible");
  });
});
