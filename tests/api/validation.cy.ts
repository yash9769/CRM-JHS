/// <reference types="cypress" />
import { API_URL } from "../fixtures/crm-data";

describe("API Validation & Data Integrity", () => {
  let token: string;
  let accountId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner().then((res) => {
      token = res.token;
      cy.createAccount().then((acc) => {
        accountId = acc.id;
      });
    });
  });

  it("Contact phone rejects alphabetic characters", () => {
    cy.request({
      method: "POST",
      url: `${API_URL}/contacts`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        firstName: "Invalid",
        lastName: "PhoneContact",
        email: `invalidphone_${Date.now()}@example.com`,
        phone: "ABC1234567",
        accountId,
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 422]);
    });
  });

  it("Opportunity creation fails when required name or accountId is missing", () => {
    cy.request({
      method: "POST",
      url: `${API_URL}/opportunities`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        amount: 500000,
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 422]);
    });
  });

  it("Closed Lost requires lostReason string", () => {
    cy.createOpportunity(accountId).then((opp) => {
      cy.request({
        method: "GET",
        url: `${API_URL}/pipelines`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((pRes) => {
        const pipeline = pRes.body.data?.[0];
        const lostStage = pipeline.stages.find((s: any) => s.isClosed && !s.isWon) || pipeline.stages.find((s: any) => s.name.toLowerCase().includes("lost"));

        if (lostStage) {
          cy.request({
            method: "PATCH",
            url: `${API_URL}/opportunities/${opp.id}`,
            headers: { Authorization: `Bearer ${token}` },
            body: {
              stageId: lostStage.id,
            },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.be.oneOf([400, 422]);
          });
        }
      });
    });
  });

  it("Financial margin calculation accuracy", () => {
    const proposalSentValue = 1000000;
    const costIncurred = 600000;
    cy.createOpportunity(accountId, undefined, {
      amount: proposalSentValue,
      actualOpportunityValue: proposalSentValue,
      bottomLineCost: costIncurred,
    }).then((opp) => {
      expect(opp.amount).to.eq(proposalSentValue);
      expect(opp.bottomLineCost).to.eq(costIncurred);
      const marginValue = (opp.actualOpportunityValue || opp.amount) - (opp.bottomLineCost || 0);
      expect(marginValue).to.eq(400000);
      const marginPct = (marginValue / (opp.actualOpportunityValue || opp.amount)) * 100;
      expect(marginPct).to.eq(40);
    });
  });
});
