/**
 * True Net Profit Calculator
 *
 * Calculates actual take-home profit after all platform fees,
 * payment processing, and shipping costs.
 */

export interface ProfitInput {
  expectedSalePrice: number;
  buyPrice: number;
  shippingCost?: number;
  category?: string;
  promotedListingRate?: number; // 0-0.15 (0-15%)
}

export interface ProfitBreakdown {
  expectedSalePrice: number;
  ebayFinalValueFee: number;
  paymentProcessingFee: number;
  shippingCost: number;
  promotedListingFee: number;
  totalPlatformCosts: number;
  buyPrice: number;
  netProfit: number;
  roi: number;           // percentage
  effectiveMargin: number; // percentage
}

// Category-specific shipping defaults
const SHIPPING_DEFAULTS: Record<string, number> = {
  'electronics-small': 8,
  'electronics-large': 15,
  'electronics': 10,
  'audio': 10,
  'clothing': 6,
  'shoes': 10,
  'books': 4,
  'media': 4,
  'home-small': 8,
  'home-large': 20,
  'home': 10,
  'kitchen': 12,
  'fragile': 12,
  'pottery': 15,
  'glass': 15,
  'collectibles': 8,
  'toys': 8,
  'games': 6,
  'sports': 10,
  'outdoor': 12,
  'default': 8,
};

// eBay fee rates by category (simplified - most are 12.9%)
const EBAY_FEE_RATES: Record<string, number> = {
  'electronics': 0.129,
  'clothing': 0.129,
  'collectibles': 0.129,
  'books': 0.1455,  // Media is higher
  'media': 0.1455,
  'music': 0.1455,
  'movies': 0.1455,
  'sports': 0.129,
  'toys': 0.129,
  'home': 0.129,
  'default': 0.129,
};

/**
 * Get the appropriate shipping cost for a category
 */
export function getShippingDefault(category?: string): number {
  if (!category) return SHIPPING_DEFAULTS.default;

  const lowerCat = category.toLowerCase();

  // Check for exact match first
  if (SHIPPING_DEFAULTS[lowerCat]) {
    return SHIPPING_DEFAULTS[lowerCat];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(SHIPPING_DEFAULTS)) {
    if (lowerCat.includes(key) || key.includes(lowerCat)) {
      return value;
    }
  }

  return SHIPPING_DEFAULTS.default;
}

/**
 * Get the eBay fee rate for a category
 */
export function getEbayFeeRate(category?: string): number {
  if (!category) return EBAY_FEE_RATES.default;

  const lowerCat = category.toLowerCase();

  for (const [key, value] of Object.entries(EBAY_FEE_RATES)) {
    if (lowerCat.includes(key)) {
      return value;
    }
  }

  return EBAY_FEE_RATES.default;
}

/**
 * Calculate true net profit with full fee breakdown
 */
export function calculateNetProfit(input: ProfitInput): ProfitBreakdown {
  const {
    expectedSalePrice,
    buyPrice,
    shippingCost,
    category,
    promotedListingRate = 0,
  } = input;

  // Determine shipping cost
  const shipping = shippingCost ?? getShippingDefault(category);

  // Calculate eBay Final Value Fee
  // FVF applies to item price + shipping
  const feeRate = getEbayFeeRate(category);
  const ebayFinalValueFee = (expectedSalePrice + shipping) * feeRate;

  // Payment processing fee (Managed Payments)
  // 2.9% + $0.30 per transaction
  const paymentProcessingFee = (expectedSalePrice * 0.029) + 0.30;

  // Promoted listing fee (optional)
  const promotedListingFee = expectedSalePrice * Math.min(promotedListingRate, 0.15);

  // Total platform costs
  const totalPlatformCosts = ebayFinalValueFee + paymentProcessingFee + promotedListingFee + shipping;

  // Net profit
  const netProfit = expectedSalePrice - totalPlatformCosts - buyPrice;

  // ROI: profit relative to total investment (buy price + shipping)
  const totalInvestment = buyPrice + shipping;
  const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

  // Effective margin: profit relative to sale price
  const effectiveMargin = expectedSalePrice > 0 ? (netProfit / expectedSalePrice) * 100 : 0;

  return {
    expectedSalePrice: round(expectedSalePrice),
    ebayFinalValueFee: round(ebayFinalValueFee),
    paymentProcessingFee: round(paymentProcessingFee),
    shippingCost: round(shipping),
    promotedListingFee: round(promotedListingFee),
    totalPlatformCosts: round(totalPlatformCosts),
    buyPrice: round(buyPrice),
    netProfit: round(netProfit),
    roi: round(roi),
    effectiveMargin: round(effectiveMargin),
  };
}

function round(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * Evaluate if a deal meets profitability thresholds
 */
export function evaluateDeal(breakdown: ProfitBreakdown): {
  isWorthIt: boolean;
  reason: string;
  severity: 'success' | 'warning' | 'error';
} {
  if (breakdown.netProfit < 0) {
    return {
      isWorthIt: false,
      reason: 'You would lose money on this flip',
      severity: 'error'
    };
  }

  if (breakdown.netProfit < 5) {
    return {
      isWorthIt: false,
      reason: 'Profit too low to be worth the effort (< $5)',
      severity: 'warning'
    };
  }

  if (breakdown.roi < 20) {
    return {
      isWorthIt: false,
      reason: 'ROI below 20% - capital better used elsewhere',
      severity: 'warning'
    };
  }

  if (breakdown.effectiveMargin < 15) {
    return {
      isWorthIt: false,
      reason: 'Margin too thin (< 15%) - risky after fees',
      severity: 'warning'
    };
  }

  if (breakdown.roi >= 100 && breakdown.netProfit >= 20) {
    return {
      isWorthIt: true,
      reason: 'Excellent flip - high ROI and solid profit',
      severity: 'success'
    };
  }

  if (breakdown.roi >= 50) {
    return {
      isWorthIt: true,
      reason: 'Good flip opportunity',
      severity: 'success'
    };
  }

  return {
    isWorthIt: true,
    reason: 'Meets minimum profitability thresholds',
    severity: 'success'
  };
}

/**
 * Find the maximum buy price to achieve a target grade
 * Uses binary search to find the price point
 */
export function findMaxBuyPriceForProfit(
  expectedSalePrice: number,
  targetNetProfit: number,
  category?: string,
  shippingCost?: number
): number {
  const shipping = shippingCost ?? getShippingDefault(category);
  const feeRate = getEbayFeeRate(category);

  // Work backwards from target profit
  // netProfit = salePrice - platformCosts - buyPrice
  // buyPrice = salePrice - platformCosts - targetNetProfit

  const ebayFee = (expectedSalePrice + shipping) * feeRate;
  const paymentFee = (expectedSalePrice * 0.029) + 0.30;
  const platformCosts = ebayFee + paymentFee + shipping;

  const maxBuyPrice = expectedSalePrice - platformCosts - targetNetProfit;

  return Math.max(0, round(maxBuyPrice));
}

/**
 * Get a formatted fee breakdown for display
 */
export function formatFeeBreakdown(breakdown: ProfitBreakdown): string[] {
  return [
    `Sale Price: $${breakdown.expectedSalePrice.toFixed(2)}`,
    `eBay Fee (12.9%): -$${breakdown.ebayFinalValueFee.toFixed(2)}`,
    `Payment Fee: -$${breakdown.paymentProcessingFee.toFixed(2)}`,
    `Shipping: -$${breakdown.shippingCost.toFixed(2)}`,
    breakdown.promotedListingFee > 0
      ? `Promoted Listing: -$${breakdown.promotedListingFee.toFixed(2)}`
      : null,
    `Your Cost: -$${breakdown.buyPrice.toFixed(2)}`,
    `───────────────`,
    `NET PROFIT: $${breakdown.netProfit.toFixed(2)}`,
  ].filter(Boolean) as string[];
}
