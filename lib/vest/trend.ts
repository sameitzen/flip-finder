import { MarketSummary, ComponentScore } from '@/lib/types';

/**
 * TREND (10%): Market direction
 *
 * Factors:
 * - 30 vs 90 day volume comparison
 * - Active price vs sold price comparison
 *
 * Rising trend = good time to sell, falling = might need to hold
 */

export function calculateTrend(market: MarketSummary): ComponentScore {
  const weight = 0.10;

  // Factor 1: Volume Trend (0-50 points)
  const annualized90 = market.totalSold90Days / 3;
  const volumeTrendRatio = annualized90 > 0 ? market.totalSold30Days / annualized90 : 1;

  let volumeScore: number;
  if (volumeTrendRatio > 1.20) volumeScore = 50;      // Growing 20%+
  else if (volumeTrendRatio > 1.05) volumeScore = 40; // Growing slightly
  else if (volumeTrendRatio > 0.95) volumeScore = 30; // Stable
  else if (volumeTrendRatio > 0.80) volumeScore = 15; // Declining
  else volumeScore = 5;                                // Declining fast

  // Factor 2: Price Direction (0-50 points)
  const priceTrendRatio = market.avgSoldPrice > 0
    ? market.avgActivePrice / market.avgSoldPrice
    : 1;

  let priceScore: number;
  if (priceTrendRatio > 1.10) priceScore = 50;        // Prices rising
  else if (priceTrendRatio > 1.02) priceScore = 40;   // Slight uptick
  else if (priceTrendRatio > 0.98) priceScore = 30;   // Stable
  else if (priceTrendRatio > 0.90) priceScore = 15;   // Prices falling
  else priceScore = 5;                                 // Significant decline

  const normalized = volumeScore + priceScore;
  const weighted = normalized * weight;

  return {
    raw: volumeTrendRatio,
    normalized,
    weighted,
    weight,
    description: getTrendDescription(normalized),
  };
}

function getTrendDescription(score: number): string {
  if (score >= 80) return 'Strong upward trend - growing demand';
  if (score >= 60) return 'Positive trend - healthy market';
  if (score >= 40) return 'Stable market - no major shifts';
  if (score >= 20) return 'Declining trend - softening demand';
  return 'Downward trend - market cooling';
}
