/**
 * Sell-Through Rate Estimation
 *
 * Since eBay's Browse API doesn't provide sold listing data,
 * we estimate sell-through rate based on:
 * 1. AI-derived demand level
 * 2. Active listing count (scarcity/saturation)
 * 3. Price position (underpriced items sell faster)
 */

export type DemandLevel = 'high' | 'medium' | 'low';
export type MarketType = 'sellers' | 'balanced' | 'buyers';
export type PricingStrategy = 'aggressive' | 'moderate' | 'conservative';

export interface SellThroughInput {
  demandLevel: DemandLevel;
  activeListingCount: number;
  aiPriceEstimate: number;
  ebayMedianPrice: number;
}

export interface SellThroughResult {
  estimatedRate: number;      // 0-1
  marketType: MarketType;
  pricingStrategy: PricingStrategy;
  reasoning: string;
  adjustments: string[];
  estimatedDaysToSell: number;
}

// Base STR by demand level (from market research)
const DEMAND_BASE_STR: Record<DemandLevel, number> = {
  high: 0.65,
  medium: 0.40,
  low: 0.20,
};

// Estimated days to sell by demand level
const DEMAND_BASE_DAYS: Record<DemandLevel, number> = {
  high: 5,
  medium: 12,
  low: 25,
};

/**
 * Estimate sell-through rate based on available signals
 */
export function estimateSellThroughRate(input: SellThroughInput): SellThroughResult {
  const {
    demandLevel,
    activeListingCount,
    aiPriceEstimate,
    ebayMedianPrice,
  } = input;

  let str = DEMAND_BASE_STR[demandLevel] ?? 0.40;
  let daysToSell = DEMAND_BASE_DAYS[demandLevel] ?? 12;
  const adjustments: string[] = [];

  // Adjustment 1: Active listing density (scarcity vs saturation)
  if (activeListingCount < 5) {
    str += 0.15;
    daysToSell -= 3;
    adjustments.push('+15% STR (scarce: <5 listings)');
  } else if (activeListingCount < 10) {
    str += 0.10;
    daysToSell -= 2;
    adjustments.push('+10% STR (low supply: <10 listings)');
  } else if (activeListingCount > 100) {
    str -= 0.15;
    daysToSell += 7;
    adjustments.push('-15% STR (very saturated: >100 listings)');
  } else if (activeListingCount > 50) {
    str -= 0.10;
    daysToSell += 4;
    adjustments.push('-10% STR (saturated: >50 listings)');
  }

  // Adjustment 2: Price position (underpriced items sell faster)
  if (ebayMedianPrice > 0) {
    const priceRatio = aiPriceEstimate / ebayMedianPrice;

    if (priceRatio < 0.7) {
      str += 0.15;
      daysToSell -= 3;
      adjustments.push('+15% STR (significantly underpriced)');
    } else if (priceRatio < 0.85) {
      str += 0.08;
      daysToSell -= 2;
      adjustments.push('+8% STR (priced below market)');
    } else if (priceRatio > 1.3) {
      str -= 0.12;
      daysToSell += 5;
      adjustments.push('-12% STR (priced above market)');
    } else if (priceRatio > 1.1) {
      str -= 0.05;
      daysToSell += 2;
      adjustments.push('-5% STR (slightly above market)');
    }
  }

  // Clamp to valid ranges
  str = Math.max(0.05, Math.min(0.95, str));
  daysToSell = Math.max(1, Math.min(45, daysToSell));

  // Determine market type and pricing strategy
  let marketType: MarketType;
  let pricingStrategy: PricingStrategy;

  if (str > 0.55) {
    marketType = 'sellers';
    pricingStrategy = 'aggressive';
  } else if (str >= 0.35) {
    marketType = 'balanced';
    pricingStrategy = 'moderate';
  } else {
    marketType = 'buyers';
    pricingStrategy = 'conservative';
  }

  // Build reasoning string
  const baseStr = DEMAND_BASE_STR[demandLevel] * 100;
  const reasoning = adjustments.length > 0
    ? `Base: ${baseStr}% (${demandLevel} demand). Adjusted: ${adjustments.join('; ')}`
    : `Base: ${baseStr}% (${demandLevel} demand). No adjustments needed.`;

  return {
    estimatedRate: Math.round(str * 100) / 100,
    marketType,
    pricingStrategy,
    reasoning,
    adjustments,
    estimatedDaysToSell: Math.round(daysToSell),
  };
}

/**
 * Select the appropriate price based on market conditions
 */
export function selectPriceByMarket(
  triangulatedPrices: { low: number; mid: number; high: number },
  sellThroughResult: SellThroughResult,
  activeMedianPrice: number
): {
  selectedPrice: number;
  priceSource: string;
  confidence: number;
} {
  const { marketType } = sellThroughResult;

  switch (marketType) {
    case 'sellers':
      // Seller's market: buyers compete, use higher prices
      // Lean toward active median or triangulated high
      const sellersPrice = Math.max(
        triangulatedPrices.mid,
        activeMedianPrice * 0.85 // 15% below asking is reasonable sold
      );
      return {
        selectedPrice: Math.round(sellersPrice * 100) / 100,
        priceSource: "Seller's market - using higher estimate",
        confidence: 0.75,
      };

    case 'balanced':
      // Balanced market: use triangulated mid
      return {
        selectedPrice: triangulatedPrices.mid,
        priceSource: 'Balanced market - using mid estimate',
        confidence: 0.65,
      };

    case 'buyers':
      // Buyer's market: be conservative, lean toward low
      const buyersPrice = (triangulatedPrices.low + triangulatedPrices.mid) / 2;
      return {
        selectedPrice: Math.round(buyersPrice * 100) / 100,
        priceSource: "Buyer's market - using conservative estimate",
        confidence: 0.55,
      };
  }
}

/**
 * Get velocity description based on estimated days to sell
 */
export function getVelocityDescription(daysToSell: number): {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  emoji: string;
} {
  if (daysToSell <= 3) {
    return { label: 'Lightning Fast', color: 'green', emoji: '⚡' };
  }
  if (daysToSell <= 7) {
    return { label: 'Very Fast', color: 'green', emoji: '🚀' };
  }
  if (daysToSell <= 14) {
    return { label: 'Quick', color: 'yellow', emoji: '✨' };
  }
  if (daysToSell <= 21) {
    return { label: 'Moderate', color: 'yellow', emoji: '⏱️' };
  }
  if (daysToSell <= 30) {
    return { label: 'Slow', color: 'orange', emoji: '🐢' };
  }
  return { label: 'Very Slow', color: 'red', emoji: '🦥' };
}

/**
 * Get market type description for UI
 */
export function getMarketTypeDescription(marketType: MarketType): {
  label: string;
  description: string;
  color: 'green' | 'yellow' | 'red';
} {
  switch (marketType) {
    case 'sellers':
      return {
        label: "Seller's Market",
        description: 'High demand, buyers compete - price aggressively',
        color: 'green',
      };
    case 'balanced':
      return {
        label: 'Balanced Market',
        description: 'Normal supply and demand - price at market',
        color: 'yellow',
      };
    case 'buyers':
      return {
        label: "Buyer's Market",
        description: 'High supply, price competitively to sell',
        color: 'red',
      };
  }
}
