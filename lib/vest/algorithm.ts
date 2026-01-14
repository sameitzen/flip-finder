import { MarketData, VestScore, VestInput } from '@/lib/types';
import { calculateVelocity } from './velocity';
import { calculateEquity } from './equity';
import { calculateStability } from './stability';
import { calculateTrend } from './trend';
import { scoreToGrade, scoreToRecommendation } from './grade';

export function calculateVestScore(
  market: MarketData,
  input: VestInput
): VestScore {
  const { buyPrice, estimatedFees = 0.13, shippingCost = 5 } = input;

  const velocity = calculateVelocity(market.summary);
  const equityResult = calculateEquity(market.summary, {
    buyPrice,
    estimatedFees,
    shippingCost,
  });
  const stability = calculateStability(market.summary);
  const trend = calculateTrend(market.summary);

  const total = velocity.weighted + equityResult.weighted + stability.weighted + trend.weighted;
  const grade = scoreToGrade(total);
  const recommendation = scoreToRecommendation(total);

  return {
    total: Math.round(total * 10) / 10,
    grade,
    components: {
      velocity,
      equity: equityResult,
      stability,
      trend,
    },
    recommendation,
    estimatedProfit: equityResult.netProfit,
    roi: equityResult.roi,
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
