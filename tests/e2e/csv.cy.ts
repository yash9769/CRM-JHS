/// <reference types="cypress" />

describe("CSV Import & Export Workflows E2E", () => {
  it("Sample Opportunity CSV is accessible and downloadable", () => {
    cy.loginAsSeniorPartner();
    cy.visit("/opportunities");
    cy.contains("Import CSV").click();
    cy.contains("Download Template").should("be.visible");
  });

  it("Manager role cannot see Export CSV button", () => {
    cy.loginAsManager();
    cy.visit("/opportunities");
    cy.contains("Export CSV").should("not.exist");
    
    cy.visit("/contacts");
    cy.contains("Export CSV").should("not.exist");
  });

  it("Partner/Senior Partner can see Export CSV button", () => {
    cy.loginAsSeniorPartner();
    cy.visit("/opportunities");
    cy.contains("Export CSV").should("be.visible");
  });
});
