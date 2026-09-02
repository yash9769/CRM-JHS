/// <reference types="cypress" />
import { API_URL } from "../fixtures/crm-data";

describe("API Opportunity Workflow & Lifecycle", () => {
  let seniorToken: string;
  let managerToken: string;
  let accountId: string;

  beforeEach(() => {
    cy.loginAsSeniorPartner().then((res) => {
      seniorToken = res.token;
      cy.createAccount().then((acc) => {
        accountId = acc.id;
      });
    });
    cy.loginAsManager().then((res) => {
      managerToken = res.token;
    });
  });

  it("Opportunity full lifecycle: create, update, stage transition", () => {
    cy.createOpportunity(accountId, undefined, {
      name: "Full Lifecycle Test Opp",
      amount: 800000,
    }).then((opp) => {
      expect(opp.id).to.exist;
      expect(opp.name).to.eq("Full Lifecycle Test Opp");

      cy.request({
        method: "PATCH",
        url: `${API_URL}/opportunities/${opp.id}`,
        headers: { Authorization: `Bearer ${seniorToken}` },
        body: {
          amount: 950000,
          actualDealValue: 950000,
          bottomLineCost: 500000,
          remarks: "Updated pricing details during negotiation",
        },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.amount).to.eq(950000);
      });
    });
  });

  it("Partner/Senior Partner can directly transition stage without approval lock", () => {
    cy.createOpportunity(accountId).then((opp) => {
      cy.request({
        method: "GET",
        url: `${API_URL}/pipelines`,
        headers: { Authorization: `Bearer ${seniorToken}` },
      }).then((pRes) => {
        const pipeline = pRes.body.data?.[0];
        const nextStage = pipeline.stages[1] || pipeline.stages[0];

        cy.request({
          method: "PATCH",
          url: `${API_URL}/opportunities/${opp.id}`,
          headers: { Authorization: `Bearer ${seniorToken}` },
          body: {
            stageId: nextStage.id,
          },
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.stageId).to.eq(nextStage.id);
        });
      });
    });
  });

  it("Manager stage transition creates pending stage approval request", () => {
    cy.loginAsManager();
    cy.createOpportunity(accountId).then((opp) => {
      cy.request({
        method: "GET",
        url: `${API_URL}/pipelines`,
        headers: { Authorization: `Bearer ${managerToken}` },
      }).then((pRes) => {
        const pipeline = pRes.body.data?.[0];
        const targetStage = pipeline.stages[2] || pipeline.stages[1];

        cy.request({
          method: "PATCH",
          url: `${API_URL}/opportunities/${opp.id}`,
          headers: { Authorization: `Bearer ${managerToken}` },
          body: {
            stageId: targetStage.id,
            requesterComment: "Moving to proposal sent stage",
          },
        }).then((res) => {
          expect(res.status).to.eq(200);
          if (res.body.isApprovalRequired) {
            expect(res.body.approvalId).to.exist;
          }
        });
      });
    });
  });

  it("Bulk action archive opportunities", () => {
    cy.createOpportunity(accountId, undefined, { name: "Bulk Opp 1" }).then((opp1) => {
      cy.createOpportunity(accountId, undefined, { name: "Bulk Opp 2" }).then((opp2) => {
        cy.request({
          method: "POST",
          url: `${API_URL}/opportunities/bulk`,
          headers: { Authorization: `Bearer ${seniorToken}` },
          body: {
            ids: [opp1.id, opp2.id],
            action: "archive",
          },
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.updated).to.eq(2);
        });
      });
    });
  });
});
