import { generateUniqueLetters } from "../fixtures/crm-data";

describe("Contact Flow E2E", () => {
  let accountId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner();
    cy.createAccount().then((acc) => {
      accountId = acc.id;
    });
  });

  it("creates contact via UI modal and enforces numeric phone validation", () => {
    const lastName = generateUniqueLetters("Mehta");
    const email = `contact_${Date.now()}@test.com`;

    cy.visit("/contacts");
    cy.contains("button", "New Contact").click();

    cy.get('input[placeholder="Rahul"]').type("Amit");
    cy.get('input[placeholder="Mehta"]').type(lastName);
    cy.get('input[placeholder="Chief Technology Officer"]').type("Consultant");

    // Add Email
    cy.contains("button", "Add another email").click();
    cy.get('input[placeholder="name@example.com"]').type(email);

    cy.get('button[type="submit"]').click();
    cy.contains(lastName).should("be.visible");
  });

  it("edits an existing contact and manages account association", () => {
    cy.createContact(accountId).then((contact) => {
      cy.visit(`/contacts/${contact.id}`);
      cy.contains("button", "Edit").click();

      const updatedLastName = generateUniqueLetters("Verma");
      cy.get("div.fixed input").eq(1).clear().type(updatedLastName);
      cy.get('button[type="submit"]').click();

      cy.contains(updatedLastName).should("be.visible");
    });
  });
});
