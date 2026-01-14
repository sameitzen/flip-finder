import { MarketSummary, ComponentScore } from '@/lib/types';

/**
 * STABILITY (10%): Price consistency
 *
 * Factors:
 * - Price volatility (std dev / mean)
 * - Min/max spread
 * - Supply balance
 *
 * Low volatility = predictable profits, less risk
 */

export function calculateStability(market: MarketSummary): ComponentScore {
  const weight = 0.10;

  // Factor 1: Volatility Score (0-50 points)
  let volatilityScore: number;
  if (market.priceVolatility < 0.10) volatilityScore = 50;
  else if (market.priceVolatility < 0.20) volatilityScore = 40;
  else if (market.priceVolatility < 0.30) volatilityScore = 25;
  else volatilityScore = 10;

  // Factor 2: Price Spread Score (0-30 points)
  const spread = market.medianSoldPrice > 0
    ? (market.maxSoldPrice - market.minSoldPrice) / market.medianSoldPrice
    : 1;

  let spreadScore: number;
  if (spread < 0.30) spreadScore = 30;
  else if (spread < 0.50) spreadScore = 20;
  else if (spread < 0.75) spreadScore = 10;
  else spreadScore = 5;

  // Factor 3: Supply Balance Score (0-20 points)
  const supplyRatio = market.totalSold30Days > 0
    ? market.activeListingCount / market.totalSold30Days
    : 2;

  let supplyScore: number;
  if (supplyRatio > 0.1 && supplyRatio < 0.5) supplyScore = 20;
  else if (supplyRatio >= 0.05 && supplyRatio <= 1.0) supplyScore = 15;
  else supplyScore = 5;

  const normalized = volatilityScore + spreadScore + supplyScore;
  const weighted = normalized * weight;

  return {
    raw: market.priceVolatility,
    normalized,
    weighted,
    weight,
    description: getStabilityDescription(normalized),
  };
}

function getStabilityDescription(score: number): string {
  if (score >= 80) return 'Very stable pricing - predictable profits';
  if (score >= 60) return 'Stable market - low price variance';
  if (score >= 40) return 'Moderate stability - some price swings';
  if (score >= 20) return 'Volatile pricing - unpredictable';
  return 'Highly volatile - significant risk';
}
