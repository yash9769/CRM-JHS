export interface FinancialsInput {
  expectedOpportunityValue?: number | string | null;
  actualOpportunityValue?: number | string | null;
  bottomLineCost?: number | string | null;
  amount?: number | string | null;
}

export interface ComputedFinancials {
  expectedOpportunityValue: number | null;
  actualOpportunityValue: number | null; // Proposal Sent Value
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
  if (actualOpportunityValue !== null && actualOpportunityValue < 0) {
    actualOpportunityValue = null;
  }

  let bottomLineCost = toNum(input.bottomLineCost);
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

  const topLineRevenue = actualOpportunityValue !== null ? actualOpportunityValue : expectedOpportunityValue;

  const marginValue =
    actualOpportunityValue !== null && bottomLineCost !== null
      ? actualOpportunityValue - bottomLineCost
      : expectedOpportunityValue !== null && bottomLineCost !== null
      ? expectedOpportunityValue - bottomLineCost
      : null;

  const revenueDenominator = actualOpportunityValue !== null ? actualOpportunityValue : expectedOpportunityValue;
  let marginPercentage: number | null = null;
  if (marginValue !== null && revenueDenominator !== null) {
    if (revenueDenominator > 0) {
      marginPercentage = Math.round(((marginValue / revenueDenominator) * 100) * 100) / 100;
    } else if (revenueDenominator === 0) {
      marginPercentage = marginValue === 0 ? 0 : marginValue > 0 ? 100 : -100;
    } else {
      marginPercentage = 0;
    }
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
