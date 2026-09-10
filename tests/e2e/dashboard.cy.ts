/// <reference types="cypress" />

describe("Dashboard Layout & Live Data E2E", () => {
  beforeEach(() => {
    cy.loginAsSeniorPartner();
  });

  it("renders main dashboard KPI cards and live action sections", () => {
    cy.visit("/dashboard");

    // Verify main KPI metrics cards
    cy.contains("Total Pipeline").should("be.visible");
    cy.contains("Weighted Pipeline").should("be.visible");
    cy.contains("Margin Value").should("be.visible");
    cy.contains("Cost Incurred").should("be.visible");

    // Verify live dashboard action sections
    cy.contains("Opportunities at Risk").should("be.visible");
    cy.contains("Pending Stage Approvals").should("be.visible");
    cy.contains("Revenue by Month").should("be.visible");
  });

  it("renders Sticky Notes widget on Dashboard", () => {
    cy.visit("/dashboard");
    cy.contains("New Note").should("be.visible");
  });
});
