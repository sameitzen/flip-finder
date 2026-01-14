import { MarketSummary, ComponentScore } from '@/lib/types';

/**
 * VELOCITY (40%): How quickly items sell
 *
 * Factors:
 * - Sales volume (30/90 day)
 * - Average days to sell
 * - Sell-through rate
 *
 * High velocity = fast money, less holding risk
 */

export function calculateVelocity(market: MarketSummary): ComponentScore {
  const weight = 0.40;

  // Factor 1: Sales Volume Score (0-40 points)
  // Based on 30-day sales. 100+ sales/month = max score
  const volumeScore = Math.min(40, (market.totalSold30Days / 100) * 40);

  // Factor 2: Days to Sell Score (0-30 points)
  let daysScore: number;
  if (market.avgDaysToSell < 3) daysScore = 30;
  else if (market.avgDaysToSell < 7) daysScore = 25;
  else if (market.avgDaysToSell < 14) daysScore = 15;
  else if (market.avgDaysToSell < 30) daysScore = 10;
  else daysScore = 5;

  // Factor 3: Sell-Through Rate Score (0-30 points)
  const strScore = market.sellThroughRate > 0.80 ? 30 :
                   market.sellThroughRate > 0.60 ? 20 :
                   market.sellThroughRate > 0.40 ? 15 : 5;

  const normalized = volumeScore + daysScore + strScore;
  const weighted = normalized * weight;

  return {
    raw: market.totalSold30Days,
    normalized,
    weighted,
    weight,
    description: getVelocityDescription(normalized),
  };
}

function getVelocityDescription(score: number): string {
  if (score >= 80) return 'Extremely fast seller - high demand';
  if (score >= 60) return 'Quick seller - good turnover';
  if (score >= 40) return 'Moderate velocity - typical sales pace';
  if (score >= 20) return 'Slow mover - may sit in inventory';
  return 'Very slow - difficult to sell';
}
