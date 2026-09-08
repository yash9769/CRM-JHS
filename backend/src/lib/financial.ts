export interface FinancialsInput {
  expectedOpportunityValue?: any;
  actualOpportunityValue?: any;
  bottomLineCost?: any;
  amount?: any;
}

export interface ComputedFinancials {
  expectedOpportunityValue: number | null;
  actualOpportunityValue: number | null; // Topline Value
  bottomLineCost: number | null;  // Cost Incurred to Company
  expectedMargin: number | null;
  grossMargin: number | null;
  marginLoss: number | null;
  topLineRevenue: number | null;
  marginValue: number | null;
  marginPercentage: number | null;
}

function toNum(val: any): number | null {
  if (val === undefined || val === null || val === "" || val === "—") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

export function computeOpportunityFinancials(input: FinancialsInput): ComputedFinancials {
  let expectedOpportunityValue = toNum(input.expectedOpportunityValue);
  if (expectedOpportunityValue === null) {
    expectedOpportunityValue = toNum(input.amount);
  }
  if (expectedOpportunityValue !== null && expectedOpportunityValue < 0) {
    expectedOpportunityValue = null;
  }

  let actualOpportunityValue = toNum(input.actualOpportunityValue);
  if (actualOpportunityValue === null) {
    actualOpportunityValue = expectedOpportunityValue;
  }
  if (actualOpportunityValue !== null && actualOpportunityValue < 0) {
    actualOpportunityValue = null;
  }

  const proposalVal = actualOpportunityValue !== null ? actualOpportunityValue : expectedOpportunityValue;

  let bottomLineCost = toNum(input.bottomLineCost);
  if (bottomLineCost === null && proposalVal !== null) {
    bottomLineCost = Math.round(proposalVal * 0.65);
  }
  if (bottomLineCost !== null && bottomLineCost < 0) {
    bottomLineCost = null;
  }

  const expectedMargin =
    expectedOpportunityValue !== null && bottomLineCost !== null
      ? expectedOpportunityValue - bottomLineCost
      : null;

  const grossMargin =
    actualOpportunityValue !== null && bottomLineCost !== null
      ? actualOpportunityValue - bottomLineCost
      : null;

  const marginLoss =
    actualOpportunityValue !== null && expectedOpportunityValue !== null
      ? Math.max(expectedOpportunityValue - actualOpportunityValue, 0)
      : null;

  const topLineRevenue = proposalVal;

  const marginValue =
    proposalVal !== null && bottomLineCost !== null
      ? proposalVal - bottomLineCost
      : null;

  let marginPercentage: number | null = null;
  if (marginValue !== null && proposalVal !== null && proposalVal > 0) {
    marginPercentage = Math.round(((marginValue / proposalVal) * 100) * 100) / 100;
  } else if (proposalVal === 0) {
    marginPercentage = 0;
  }

  return {
    expectedOpportunityValue,
    actualOpportunityValue,
    bottomLineCost,
    expectedMargin,
    grossMargin,
    marginLoss,
    topLineRevenue,
    marginValue,
    marginPercentage,
  };
}
