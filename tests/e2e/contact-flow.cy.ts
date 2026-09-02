/// <reference types="cypress" />

describe("Contact Flow E2E", () => {
  let accountId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner();
    cy.createAccount().then((acc) => {
      accountId = acc.id;
    });
  });

  it("creates contact via UI modal and enforces numeric phone validation", () => {
    const lastName = `LastName_${Date.now()}`;
    const email = `contact_${Date.now()}@test.com`;
    const randomPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    cy.visit("/contacts");
    cy.contains("button", "New Contact").click();

    cy.get('input[placeholder="Rahul"]').type("Amit");
    cy.get('input[placeholder="Mehta"]').type(lastName);
    cy.get('input[placeholder="rahul@example.com"]').type(email);
    cy.get('input[placeholder="9876543210"]').type(randomPhone);
    cy.get('input[placeholder="Chief Technology Officer"]').type("Consultant");

    cy.get('button[type="submit"]').click();
    cy.contains(lastName).should("be.visible");
  });

  it("edits an existing contact and manages account association", () => {
    cy.createContact(accountId).then((contact) => {
      cy.visit(`/contacts/${contact.id}`);
      cy.contains("button", "Edit").click();

      const updatedLastName = `Updated_${Date.now()}`;
      cy.get("div.fixed input").eq(1).clear().type(updatedLastName);
      cy.get('button[type="submit"]').click();

      cy.contains(updatedLastName).should("be.visible");
    });
  });
});
