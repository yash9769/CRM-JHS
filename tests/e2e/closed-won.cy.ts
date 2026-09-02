/// <reference types="cypress" />

describe("Closed Won Workflow E2E", () => {
  let accountId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner();
    cy.createAccount().then((acc) => {
      accountId = acc.id;
    });
  });

  it("Senior Partner can directly close opportunity as Closed Won with attachment and PO value", () => {
    cy.createOpportunity(accountId, undefined, { name: `Direct Closed Won Opp ${Date.now()}` }).then((opp) => {
      cy.visit(`/opportunities/${opp.id}`);
      
      // Select Closed Won stage from stage dropdown
      cy.get("select").select("Closed Won");

      // Verify Closed Won modal mandatory fields
      cy.contains("Deal Close Requirements").should("be.visible");
      
      // Select sample file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from("LOE Confirmation Sample Document"),
        fileName: "LOE_Confirmation.pdf",
        mimeType: "application/pdf",
      }, { force: true });

      // Enter PO Value
      cy.get('input[placeholder="e.g. 1000000"]').clear().type("850000");

      cy.get('button[type="submit"]').click();
      cy.contains("Closed Won").should("be.visible");
    });
  });

  it("Manager submits Closed Won for stage approval", () => {
    cy.loginAsManager();
    cy.createOpportunity(accountId, undefined, { name: `Manager Closed Won Opp ${Date.now()}` }).then((opp) => {
      cy.visit(`/opportunities/${opp.id}`);
      
      cy.get("select").select("Closed Won");

      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from("LOE Attachment"),
        fileName: "Client_Email_Confirmation.pdf",
        mimeType: "application/pdf",
      }, { force: true });

      cy.get('input[placeholder="e.g. 1000000"]').clear().type("500000");

      cy.get('button[type="submit"]').click();
      cy.contains("Stage Change Approvals").should("be.visible");
    });
  });
});
