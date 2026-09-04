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
  if (actualOpportunityValue !== null && actualOpportunityValue < 0) {
    actualOpportunityValue = null;
  }

  let bottomLineCost = toNum(input.bottomLineCost);
  if (bottomLineCost !== null && bottomLineCost < 0) {
    bottomLineCost = null;
  }

  // 1. Expected Margin = Expected Opportunity Value - Cost Incurred to Company
  const expectedMargin =
    expectedOpportunityValue !== null && bottomLineCost !== null
      ? expectedOpportunityValue - bottomLineCost
      : null;

  // 2. Gross Margin / Realized Margin = Topline Value - Cost Incurred to Company (Can be negative!)
  const grossMargin =
    actualOpportunityValue !== null && bottomLineCost !== null
      ? actualOpportunityValue - bottomLineCost
      : null;

  // 3. Margin Loss = MAX(Expected Opportunity Value - Topline Value, 0)
  const marginLoss =
    actualOpportunityValue !== null && expectedOpportunityValue !== null
      ? Math.max(expectedOpportunityValue - actualOpportunityValue, 0)
      : null;

  // 4. Top-Line Revenue = Topline Value (or Expected Opportunity Value if actual is null)
  const topLineRevenue = actualOpportunityValue !== null ? actualOpportunityValue : expectedOpportunityValue;

  // 5. Margin Value: If Topline Value is present, use Topline - Cost; otherwise Expected - Cost
  const marginValue =
    actualOpportunityValue !== null && bottomLineCost !== null
      ? actualOpportunityValue - bottomLineCost
      : expectedOpportunityValue !== null && bottomLineCost !== null
      ? expectedOpportunityValue - bottomLineCost
      : null;

  // 6. Margin Percentage: Safely calculate percentage against relevant revenue denominator
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
