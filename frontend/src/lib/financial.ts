export interface FinancialsInput {
  expectedDealValue?: number | string | null;
  actualDealValue?: number | string | null;
  bottomLineCost?: number | string | null;
  amount?: number | string | null;
}

export interface ComputedFinancials {
  expectedDealValue: number | null;
  actualDealValue: number | null; // Proposal Sent Value
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
  let expectedDealValue = toNum(input.expectedDealValue);
  if (expectedDealValue === null) {
    expectedDealValue = toNum(input.amount);
  }
  if (expectedDealValue !== null && expectedDealValue < 0) {
    expectedDealValue = null;
  }

  let actualDealValue = toNum(input.actualDealValue);
  if (actualDealValue !== null && actualDealValue < 0) {
    actualDealValue = null;
  }

  let bottomLineCost = toNum(input.bottomLineCost);
  if (bottomLineCost !== null && bottomLineCost < 0) {
    bottomLineCost = null;
  }

  const expectedMargin =
    expectedDealValue !== null && bottomLineCost !== null
      ? expectedDealValue - bottomLineCost
      : null;

  const grossMargin =
    actualDealValue !== null && bottomLineCost !== null
      ? actualDealValue - bottomLineCost
      : null;

  const marginLoss =
    actualDealValue !== null && expectedDealValue !== null
      ? Math.max(expectedDealValue - actualDealValue, 0)
      : null;

  const topLineRevenue = actualDealValue !== null ? actualDealValue : expectedDealValue;

  const marginValue =
    actualDealValue !== null && bottomLineCost !== null
      ? actualDealValue - bottomLineCost
      : expectedDealValue !== null && bottomLineCost !== null
      ? expectedDealValue - bottomLineCost
      : null;

  const revenueDenominator = actualDealValue !== null ? actualDealValue : expectedDealValue;
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
    expectedDealValue,
    actualDealValue,
    bottomLineCost,
    expectedMargin,
    grossMargin,
    marginLoss,
    topLineRevenue,
    marginValue,
    marginPercentage,
  };
}
