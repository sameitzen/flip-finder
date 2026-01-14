import { MarketSummary, ComponentScore, VestInput } from '@/lib/types';

/**
 * EQUITY (40%): Profit margin potential
 *
 * Factors:
 * - Gross margin (sell price - buy price)
 * - ROI percentage
 * - Dollar profit amount
 *
 * This updates in REAL-TIME as user adjusts buy price slider
 */

export interface EquityResult extends ComponentScore {
  netProfit: number;
  roi: number;
  grossMargin: number;
}

export function calculateEquity(
  market: MarketSummary,
  input: VestInput
): EquityResult {
  const weight = 0.40;
  const { buyPrice, estimatedFees = 0.13, shippingCost = 5 } = input;

  // Expected sell price (use median for stability)
  const expectedSellPrice = market.medianSoldPrice;

  // Calculate gross profit
  const totalCost = buyPrice + shippingCost;
  const fees = expectedSellPrice * estimatedFees;
  const netProfit = expectedSellPrice - totalCost - fees;
  const grossMargin = expectedSellPrice > 0 ? netProfit / expectedSellPrice : 0;

  // Calculate ROI
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  // Factor 1: Margin Score (0-50 points)
  let marginScore: number;
  if (grossMargin >= 0.50) marginScore = 50;
  else if (grossMargin >= 0.40) marginScore = 40;
  else if (grossMargin >= 0.30) marginScore = 30;
  else if (grossMargin >= 0.20) marginScore = 20;
  else if (grossMargin >= 0.10) marginScore = 10;
  else if (grossMargin >= 0) marginScore = 5;
  else marginScore = 0;

  // Factor 2: ROI Score (0-30 points)
  let roiScore: number;
  if (roi >= 100) roiScore = 30;
  else if (roi >= 75) roiScore = 25;
  else if (roi >= 50) roiScore = 20;
  else if (roi >= 25) roiScore = 15;
  else if (roi >= 0) roiScore = 5;
  else roiScore = 0;

  // Factor 3: Dollar Profit Score (0-20 points)
  let dollarScore: number;
  if (netProfit >= 50) dollarScore = 20;
  else if (netProfit >= 30) dollarScore = 15;
  else if (netProfit >= 15) dollarScore = 10;
  else if (netProfit >= 5) dollarScore = 5;
  else dollarScore = 0;

  const normalized = marginScore + roiScore + dollarScore;
  const weighted = normalized * weight;

  return {
    raw: netProfit,
    normalized,
    weighted,
    weight,
    description: getEquityDescription(normalized, netProfit),
    netProfit: Math.round(netProfit * 100) / 100,
    roi: Math.round(roi * 10) / 10,
    grossMargin: Math.round(grossMargin * 1000) / 10,
  };
}

function getEquityDescription(score: number, profit: number): string {
  const profitStr = profit >= 0 ? `$${profit.toFixed(0)}` : `-$${Math.abs(profit).toFixed(0)}`;
  if (score >= 80) return `Excellent margin - Est. ${profitStr} profit`;
  if (score >= 60) return `Good profit potential - Est. ${profitStr}`;
  if (score >= 40) return `Decent margins - Est. ${profitStr}`;
  if (score >= 20) return `Thin margins - Est. ${profitStr}`;
  return `Poor/negative margins - Est. ${profitStr}`;
}
