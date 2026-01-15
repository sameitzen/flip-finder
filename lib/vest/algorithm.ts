import { MarketData, VestScore, VestInput, Grade } from '@/lib/types';
import { calculateVelocity } from './velocity';
import { calculateEquity } from './equity';
import { calculateStability } from './stability';
import { calculateTrend } from './trend';
import { scoreToGrade, scoreToRecommendation } from './grade';
import { applyGradeOverride, getOverrideExplanation, OverrideResult } from './grade-override';
import { calculateNetProfit, ProfitBreakdown } from '@/lib/utils/profit-calculator';

export interface ExtendedVestScore extends VestScore {
  profitBreakdown: ProfitBreakdown;
  gradeOverride: OverrideResult | null;
  overrideExplanation: string | null;
}

export function calculateVestScore(
  market: MarketData,
  input: VestInput
): ExtendedVestScore {
  const { buyPrice, shippingCost = 5 } = input;

  const velocity = calculateVelocity(market.summary);
  const equityResult = calculateEquity(market.summary, {
    buyPrice,
    shippingCost,
  });
  const stability = calculateStability(market.summary);
  const trend = calculateTrend(market.summary);

  // Calculate true net profit with full fee breakdown
  const profitBreakdown = calculateNetProfit({
    expectedSalePrice: market.summary.medianSoldPrice,
    buyPrice,
    shippingCost,
  });

  const rawTotal = velocity.weighted + equityResult.weighted + stability.weighted + trend.weighted;
  const rawGrade = scoreToGrade(rawTotal);

  // Apply grade override rules (velocity/margin/market overrides)
  const overrideInput = {
    score: rawTotal,
    grade: rawGrade,
    daysToSell: market.summary.avgDaysToSell,
    netProfit: profitBreakdown.netProfit,
    grossMargin: profitBreakdown.effectiveMargin / 100,
    sellThroughRate: market.summary.sellThroughRate,
  };

  const gradeOverride = applyGradeOverride(overrideInput);
  const overrideExplanation = getOverrideExplanation(gradeOverride);

  // Use overridden grade and score if applicable
  const finalScore = gradeOverride.finalScore;
  const finalGrade = gradeOverride.finalGrade;
  const recommendation = scoreToRecommendation(finalScore);

  return {
    total: Math.round(finalScore * 10) / 10,
    grade: finalGrade,
    components: {
      velocity,
      equity: equityResult,
      stability,
      trend,
    },
    recommendation,
    estimatedProfit: profitBreakdown.netProfit,
    roi: profitBreakdown.roi,
    profitBreakdown,
    gradeOverride: gradeOverride.overrideApplied ? gradeOverride : null,
    overrideExplanation,
  };
}

export function suggestBuyPrice(market: MarketData, targetGrade: 'A' | 'B' | 'C'): number {
  const targetScore = targetGrade === 'A' ? 90 : targetGrade === 'B' ? 80 : 70;
  const medianPrice = market.summary.medianSoldPrice;
  const fees = medianPrice * 0.13;
  const shipping = 5;

  // Work backwards from target score
  // Assuming velocity, stability, trend contribute ~50 points on average
  // We need equity to contribute enough to hit target
  const neededEquityWeighted = (targetScore - 50) / 0.4 * 0.4;

  // If needed equity is 32 (80 normalized * 0.4), we need ~80% margin score
  // This roughly means we need ~40% gross margin

  // gross margin = (sell - buy - fees - ship) / sell
  // 0.4 = (median - buy - fees - ship) / median
  // 0.4 * median = median - buy - fees - ship
  // buy = median - 0.4 * median - fees - ship
  // buy = median * 0.6 - fees - ship

  const targetMargin = neededEquityWeighted / 0.4 / 100 + 0.1; // rough approximation
  const suggestedBuy = medianPrice * (1 - targetMargin) - fees - shipping;

  return Math.max(0, Math.round(suggestedBuy));
}
