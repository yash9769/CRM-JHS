/// <reference types="cypress" />

describe("Account Flow E2E", () => {
  beforeEach(() => {
    cy.loginAsSeniorPartner();
  });

  it("creates a new account via UI modal and views account details", () => {
    const accountName = `Beta Account ${Date.now()}`;
    cy.visit("/accounts");
    cy.contains("button", "New Account").click();

    cy.get('input[placeholder="e.g. Acme Technologies"]').type(accountName);
    cy.get('input[placeholder="Information Technology"]').type("Enterprise Security");
    cy.get('input[placeholder="+91 98765 43210"]').type("9876543210");
    cy.get('input[placeholder="https://acme.com"]').type("https://beta-account.com");

    cy.get('button[type="submit"]').click();
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
      cy.get("div.fixed input").first().clear().type(updatedName);
      cy.get('button[type="submit"]').click();

      cy.contains(updatedName).should("be.visible");
    });
  });
});
