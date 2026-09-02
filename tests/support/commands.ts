/// <reference types="cypress" />

import {
  createAccountFixture,
  createContactFixture,
  createOpportunityFixture,
  type TestAccountInput,
  type TestContactInput,
  type TestOpportunityInput,
} from "../fixtures/crm-data";

const ENV = {
  apiUrl: "http://localhost:4000/api/v1",
  MANAGER_EMAIL: "manager@crm.com",
  MANAGER_PASSWORD: "Password123!",
  PARTNER_EMAIL: "partner@crm.com",
  PARTNER_PASSWORD: "Password123!",
  SENIOR_PARTNER_EMAIL: "senior.partner@crm.com",
  SENIOR_PARTNER_PASSWORD: "Password123!",
};

let currentToken: string | null = null;

// Automatically attach crm_token to window.localStorage on every window load
Cypress.on("window:before:load", (win) => {
  if (currentToken) {
    win.localStorage.setItem("crm_token", currentToken);
  }
});

Cypress.Commands.add("login", (email?: string, password?: string) => {
  const userEmail = email || ENV.SENIOR_PARTNER_EMAIL;
  const userPassword = password || ENV.SENIOR_PARTNER_PASSWORD;

  return cy.request({
    method: "POST",
    url: `${ENV.apiUrl}/auth/login`,
    body: { email: userEmail, password: userPassword },
  }).then((response) => {
    expect(response.status).to.eq(200);
    const token = response.body.token;
    const user = response.body.user;
    currentToken = token;
    return { token, user };
  });
});

Cypress.Commands.add("loginAsManager", () => {
  return cy.login(ENV.MANAGER_EMAIL, ENV.MANAGER_PASSWORD);
});

Cypress.Commands.add("loginAsPartner", () => {
  return cy.login(ENV.PARTNER_EMAIL, ENV.PARTNER_PASSWORD);
});

Cypress.Commands.add("loginAsSeniorPartner", () => {
  return cy.login(ENV.SENIOR_PARTNER_EMAIL, ENV.SENIOR_PARTNER_PASSWORD);
});

Cypress.Commands.add("createAccount", (data?: Partial<TestAccountInput>) => {
  const payload = createAccountFixture(data);
  return cy.request({
    method: "POST",
    url: `${ENV.apiUrl}/accounts`,
    headers: { Authorization: `Bearer ${currentToken}` },
    body: payload,
  }).then((res) => res.body);
});

Cypress.Commands.add("createContact", (accountId?: string, data?: Partial<TestContactInput>) => {
  const payload = createContactFixture(accountId, data);
  return cy.request({
    method: "POST",
    url: `${ENV.apiUrl}/contacts`,
    qs: { force: "true" },
    headers: { Authorization: `Bearer ${currentToken}` },
    body: payload,
  }).then((res) => res.body);
});

Cypress.Commands.add("createOpportunity", (accountId: string, contactId?: string, data?: Partial<TestOpportunityInput>) => {
  return cy.request({
    method: "GET",
    url: `${ENV.apiUrl}/auth/me`,
    headers: { Authorization: `Bearer ${currentToken}` },
  }).then((meRes) => {
    const ownerId = meRes.body.user?.id;
    return cy.request({
      method: "GET",
      url: `${ENV.apiUrl}/pipelines`,
      headers: { Authorization: `Bearer ${currentToken}` },
    }).then((pRes) => {
      const pipeline = pRes.body.data?.find((p: any) => p.type === "OPPORTUNITY") || pRes.body.data?.[0];
      const stageId = data?.stageId || pipeline?.stages?.[0]?.id;
      const payload = createOpportunityFixture(accountId, contactId, data);
      return cy.request({
        method: "POST",
        url: `${ENV.apiUrl}/opportunities`,
        headers: { Authorization: `Bearer ${currentToken}` },
        body: {
          ...payload,
          ownerId,
          stageId,
          pipelineId: pipeline?.id,
        },
      }).then((res) => res.body);
    });
  });
});
