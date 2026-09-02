export interface FinancialsInput {
  expectedDealValue?: any;
  actualDealValue?: any;
  bottomLineCost?: any;
  amount?: any;
}

export interface ComputedFinancials {
  expectedDealValue: number | null;
  actualDealValue: number | null; // Topline Value
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

  // 1. Expected Margin = Expected Deal Value - Cost Incurred to Company
  const expectedMargin =
    expectedDealValue !== null && bottomLineCost !== null
      ? expectedDealValue - bottomLineCost
      : null;

  // 2. Gross Margin / Realized Margin = Topline Value - Cost Incurred to Company (Can be negative!)
  const grossMargin =
    actualDealValue !== null && bottomLineCost !== null
      ? actualDealValue - bottomLineCost
      : null;

  // 3. Margin Loss = MAX(Expected Deal Value - Topline Value, 0)
  const marginLoss =
    actualDealValue !== null && expectedDealValue !== null
      ? Math.max(expectedDealValue - actualDealValue, 0)
      : null;

  // 4. Top-Line Revenue = Topline Value (or Expected Deal Value if actual is null)
  const topLineRevenue = actualDealValue !== null ? actualDealValue : expectedDealValue;

  // 5. Margin Value: If Topline Value is present, use Topline - Cost; otherwise Expected - Cost
  const marginValue =
    actualDealValue !== null && bottomLineCost !== null
      ? actualDealValue - bottomLineCost
      : expectedDealValue !== null && bottomLineCost !== null
      ? expectedDealValue - bottomLineCost
      : null;

  // 6. Margin Percentage: Safely calculate percentage against relevant revenue denominator
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
