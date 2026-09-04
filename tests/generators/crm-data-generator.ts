import {
  createAccountFixture,
  createContactFixture,
  createOpportunityFixture,
  type TestAccountInput,
  type TestContactInput,
  type TestOpportunityInput,
} from "../fixtures/crm-data";

export interface ScenarioOptions {
  accountData?: Partial<TestAccountInput>;
  contacts?: number;
  opportunities?: number;
  leads?: number;
  quotes?: number;
}

export interface CRMScenarioResult {
  account: any;
  contacts: any[];
  opportunities: any[];
  leads: any[];
  quotes: any[];
}

export function createCRMScenario(options: ScenarioOptions = {}): Cypress.Chainable<CRMScenarioResult> {
  const numContacts = options.contacts ?? 2;
  const numOpps = options.opportunities ?? 2;
  const numLeads = options.leads ?? 1;
  const numQuotes = options.quotes ?? 1;

  return cy.createAccount(options.accountData).then((account) => {
    const contacts: any[] = [];
    const opportunities: any[] = [];
    const leads: any[] = [];
    const quotes: any[] = [];

    // Create Contacts
    const contactPromises: Cypress.Chainable<any>[] = [];
    for (let i = 0; i < numContacts; i++) {
      contactPromises.push(cy.createContact(account.id, { firstName: `Scenario_${i + 1}` }));
    }

    return cy.wrap(contactPromises).each((promise: any) => {
      return promise.then((c: any) => contacts.push(c));
    }).then(() => {
      // Create Opportunities
      const oppPromises: Cypress.Chainable<any>[] = [];
      const mainContactId = contacts[0]?.id || null;
      for (let i = 0; i < numOpps; i++) {
        oppPromises.push(
          cy.createOpportunity(account.id, mainContactId, {
            name: `Scenario Opp ${i + 1} - ${Date.now()}`,
            amount: 500000 + i * 100000,
            actualOpportunityValue: 500000 + i * 100000,
            bottomLineCost: 300000 + i * 50000,
          })
        );
      }

      return cy.wrap(oppPromises).each((promise: any) => {
        return promise.then((o: any) => opportunities.push(o));
      });
    }).then(() => {
      // Create Leads
      const leadPromises: Cypress.Chainable<any>[] = [];
      for (let i = 0; i < numLeads; i++) {
        leadPromises.push(cy.createLead({ lastName: `Lead_${i + 1}` }));
      }

      return cy.wrap(leadPromises).each((promise: any) => {
        return promise.then((l: any) => leads.push(l));
      });
    }).then(() => {
      // Create Quotes for Opportunities
      const quotePromises: Cypress.Chainable<any>[] = [];
      if (opportunities.length > 0 && numQuotes > 0) {
        for (let i = 0; i < Math.min(numQuotes, opportunities.length); i++) {
          quotePromises.push(cy.createQuote(opportunities[i].id));
        }
      }

      return cy.wrap(quotePromises).each((promise: any) => {
        return promise.then((q: any) => quotes.push(q));
      });
    }).then(() => {
      return {
        account,
        contacts,
        opportunities,
        leads,
        quotes,
      };
    });
  });
}
