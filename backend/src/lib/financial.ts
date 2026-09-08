export interface FinancialsInput {
  expectedOpportunityValue?: any;
  proposalValue?: any;
  actualOpportunityValue?: any;
  costIncurredToCompany?: any;
  bottomLineCost?: any;
  amount?: any;
}

export interface ComputedFinancials {
  expectedOpportunityValue: number | null;
  proposalValue: number | null;
  actualOpportunityValue: number | null;
  costIncurredToCompany: number | null;
  bottomLineCost: number | null;
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

  let proposalValue = toNum(input.proposalValue) ?? toNum(input.actualOpportunityValue);
  if (proposalValue === null) {
    proposalValue = expectedOpportunityValue;
  }
  if (proposalValue !== null && proposalValue < 0) {
    proposalValue = null;
  }

  const actualOpportunityValue = proposalValue;
  const proposalVal = proposalValue;

  let costIncurredToCompany = toNum(input.costIncurredToCompany) ?? toNum(input.bottomLineCost);
  if (costIncurredToCompany === null && proposalVal !== null) {
    costIncurredToCompany = Math.round(proposalVal * 0.65);
  }
  if (costIncurredToCompany !== null && costIncurredToCompany < 0) {
    costIncurredToCompany = null;
  }

  const bottomLineCost = costIncurredToCompany;

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
    proposalValue,
    actualOpportunityValue,
    costIncurredToCompany,
    bottomLineCost,
    expectedMargin,
    grossMargin,
    marginLoss,
    topLineRevenue,
    marginValue,
    marginPercentage,
  };
}
