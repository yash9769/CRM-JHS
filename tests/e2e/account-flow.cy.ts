/// <reference types="cypress" />

describe("Account Flow E2E", () => {
  beforeEach(() => {
    cy.loginAsSeniorPartner();
  });

  it("creates a new account via UI modal and views account details", () => {
    const accountName = `Beta Account ${Date.now()}`;
    const domain = `beta-${Date.now()}.com`;
    cy.visit("/accounts");
    cy.contains("button", "New Account").click();

    cy.get('input[placeholder="e.g. Acme Technologies"]').type(accountName);
    cy.get('input[placeholder="Information Technology"]').type("Enterprise Security");
    cy.get('input[placeholder="acme.com"]').type(domain);

    cy.intercept("POST", "**/api/v1/accounts*").as("createAccount");
    cy.get('button[type="submit"]').click();
    cy.wait("@createAccount");
    cy.get('input[placeholder="Search accounts…"]').type(accountName);
    cy.contains(accountName).should("be.visible");

    // Click into detail page
    cy.contains(accountName).click();
    cy.url().should("include", "/accounts/");
    cy.contains("Enterprise Security").should("be.visible");
  });

  it("edits an existing account", () => {
    cy.createAccount({ name: `Edit Test Account ${Date.now()}` }).then((acc) => {
      cy.visit(`/accounts/${acc.id}`);
      cy.contains("button", "Edit").click();

      const updatedName = `Updated ${acc.name}`;
      cy.get("input[required]").filter(":visible").first().clear().type(updatedName);
      cy.get('button[type="submit"]').click();

      cy.contains(updatedName).should("be.visible");
    });
  });
});
