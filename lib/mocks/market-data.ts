import { MarketData, MarketSummary, SoldListing, ActiveListing, AIPriceEstimate } from '@/lib/types';

function generateSoldListings(
  basePrice: number,
  count: number,
  volatility: number
): SoldListing[] {
  const listings: SoldListing[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const variance = (Math.random() - 0.5) * 2 * volatility;
    const price = basePrice * (1 + variance);
    const daysAgo = Math.floor(Math.random() * 30);

    listings.push({
      title: `Item listing ${i + 1}`,
      soldPrice: Math.round(price * 100) / 100,
      soldDate: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
      condition: ['Used - Like New', 'Used - Good', 'Used - Fair'][Math.floor(Math.random() * 3)],
      shippingCost: Math.random() > 0.5 ? 0 : Math.round(Math.random() * 15),
    });
  }

  return listings.sort((a, b) => b.soldDate.getTime() - a.soldDate.getTime());
}

function generateActiveListings(
  basePrice: number,
  count: number,
  volatility: number
): ActiveListing[] {
  const listings: ActiveListing[] = [];

  for (let i = 0; i < count; i++) {
    const variance = (Math.random() - 0.3) * 2 * volatility; // Slightly higher than sold
    const price = basePrice * (1 + variance);

    listings.push({
      title: `Active listing ${i + 1}`,
      currentPrice: Math.round(price * 100) / 100,
      listingType: Math.random() > 0.7 ? 'auction' : 'buy-it-now',
      bids: Math.random() > 0.7 ? Math.floor(Math.random() * 15) : undefined,
      watchers: Math.floor(Math.random() * 30),
      condition: ['Used - Like New', 'Used - Good', 'Used - Fair'][Math.floor(Math.random() * 3)],
    });
  }

  return listings;
}

function calculateSummary(
  soldListings: SoldListing[],
  activeListings: ActiveListing[],
  avgDaysToSell: number
): MarketSummary {
  const soldPrices = soldListings.map(l => l.soldPrice).sort((a, b) => a - b);
  const activePrices = activeListings.map(l => l.currentPrice);

  const avgSoldPrice = soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length;
  const medianSoldPrice = soldPrices[Math.floor(soldPrices.length / 2)];
  const avgActivePrice = activePrices.reduce((a, b) => a + b, 0) / activePrices.length;

  const priceVolatility = Math.sqrt(
    soldPrices.reduce((sum, p) => sum + Math.pow(p - avgSoldPrice, 2), 0) / soldPrices.length
  ) / avgSoldPrice;

  const totalSold30Days = soldListings.length;
  const totalSold90Days = Math.round(totalSold30Days * 2.8);

  return {
    avgSoldPrice: Math.round(avgSoldPrice * 100) / 100,
    medianSoldPrice: Math.round(medianSoldPrice * 100) / 100,
    minSoldPrice: Math.round(Math.min(...soldPrices) * 100) / 100,
    maxSoldPrice: Math.round(Math.max(...soldPrices) * 100) / 100,
    totalSold30Days,
    totalSold90Days,
    avgDaysToSell,
    activeListingCount: activeListings.length,
    avgActivePrice: Math.round(avgActivePrice * 100) / 100,
    sellThroughRate: totalSold30Days / (totalSold30Days + activeListings.length),
    priceVolatility: Math.round(priceVolatility * 1000) / 1000,
  };
}

interface MockMarketConfig {
  basePrice: number;
  volatility: number;
  soldCount: number;
  activeCount: number;
  avgDaysToSell: number;
}

const mockMarketConfigs: Record<string, MockMarketConfig> = {
  headphones: {
    basePrice: 185,
    volatility: 0.15,
    soldCount: 847,
    activeCount: 156,
    avgDaysToSell: 3.2,
  },
  camera: {
    basePrice: 145,
    volatility: 0.25,
    soldCount: 234,
    activeCount: 89,
    avgDaysToSell: 7.5,
  },
  sneakers: {
    basePrice: 320,
    volatility: 0.20,
    soldCount: 1250,
    activeCount: 340,
    avgDaysToSell: 2.1,
  },
  vinyl: {
    basePrice: 45,
    volatility: 0.35,
    soldCount: 156,
    activeCount: 78,
    avgDaysToSell: 12.3,
  },
  watch: {
    basePrice: 375,
    volatility: 0.18,
    soldCount: 523,
    activeCount: 167,
    avgDaysToSell: 4.8,
  },
  game: {
    basePrice: 95,
    volatility: 0.22,
    soldCount: 678,
    activeCount: 234,
    avgDaysToSell: 5.2,
  },
  jacket: {
    basePrice: 285,
    volatility: 0.20,
    soldCount: 89,
    activeCount: 34,
    avgDaysToSell: 9.5,
  },
  pottery: {
    basePrice: 65,
    volatility: 0.40,
    soldCount: 23,
    activeCount: 12,
    avgDaysToSell: 21.0,
  },
  art: {
    basePrice: 450,
    volatility: 0.50,
    soldCount: 8,
    activeCount: 5,
    avgDaysToSell: 45.0,
  },
  kitchenaid: {
    basePrice: 225,
    volatility: 0.12,
    soldCount: 1890,
    activeCount: 420,
    avgDaysToSell: 2.5,
  },
  lego: {
    basePrice: 650,
    volatility: 0.10,
    soldCount: 234,
    activeCount: 56,
    avgDaysToSell: 6.8,
  },
  book: {
    basePrice: 2500,
    volatility: 0.45,
    soldCount: 12,
    activeCount: 8,
    avgDaysToSell: 35.0,
  },
};

const defaultConfig: MockMarketConfig = {
  basePrice: 50,
  volatility: 0.30,
  soldCount: 45,
  activeCount: 25,
  avgDaysToSell: 14.0,
};

export async function mockFetchMarketData(searchQuery: string): Promise<MarketData> {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

  // Find matching config
  const key = Object.keys(mockMarketConfigs).find(k =>
    searchQuery.toLowerCase().includes(k)
  );
  const config = key ? mockMarketConfigs[key] : defaultConfig;

  // Generate limited listings for display (not all 847)
  const displaySoldCount = Math.min(config.soldCount, 20);
  const displayActiveCount = Math.min(config.activeCount, 10);

  const soldListings = generateSoldListings(config.basePrice, displaySoldCount, config.volatility);
  const activeListings = generateActiveListings(config.basePrice, displayActiveCount, config.volatility);

  // Calculate summary with full counts
  const summary = calculateSummary(soldListings, activeListings, config.avgDaysToSell);
  summary.totalSold30Days = config.soldCount;
  summary.totalSold90Days = Math.round(config.soldCount * 2.8);
  summary.activeListingCount = config.activeCount;
  summary.sellThroughRate = config.soldCount / (config.soldCount + config.activeCount);

  return {
    soldListings,
    activeListings,
    summary,
  };
}

/**
 * Generate realistic market data based on AI price estimates
 * This uses Gemini's knowledge to create plausible market conditions
 */
export function generateMarketDataFromAIEstimate(
  estimate: AIPriceEstimate,
  itemName: string
): MarketData {
  const { low, mid, high, demandLevel } = estimate;

  // Derive market characteristics from AI estimate
  const priceSpread = (high - low) / mid;
  const volatility = Math.min(0.5, Math.max(0.1, priceSpread / 2));

  // Demand level affects sales volume and days to sell
  const demandMultipliers = {
    high: { soldCount: 150, activeCount: 40, daysToSell: 3 },
    medium: { soldCount: 50, activeCount: 30, daysToSell: 10 },
    low: { soldCount: 15, activeCount: 20, daysToSell: 25 },
  };

  const multipliers = demandMultipliers[demandLevel];

  // Generate listings centered around the mid estimate
  const displaySoldCount = Math.min(multipliers.soldCount, 20);
  const displayActiveCount = Math.min(multipliers.activeCount, 10);

  const soldListings = generateSoldListingsFromEstimate(
    low,
    mid,
    high,
    displaySoldCount,
    itemName
  );

  const activeListings = generateActiveListingsFromEstimate(
    mid,
    high,
    displayActiveCount,
    itemName
  );

  // Calculate summary
  const soldPrices = soldListings.map(l => l.soldPrice).sort((a, b) => a - b);
  const activePrices = activeListings.map(l => l.currentPrice);

  const avgSoldPrice = soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length;
  const medianSoldPrice = soldPrices[Math.floor(soldPrices.length / 2)] || mid;
  const avgActivePrice = activePrices.length > 0
    ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length
    : mid * 1.1;

  const summary: MarketSummary = {
    avgSoldPrice: Math.round(avgSoldPrice * 100) / 100,
    medianSoldPrice: Math.round(medianSoldPrice * 100) / 100,
    minSoldPrice: Math.round(low * 100) / 100,
    maxSoldPrice: Math.round(high * 100) / 100,
    totalSold30Days: multipliers.soldCount,
    totalSold90Days: Math.round(multipliers.soldCount * 2.5),
    avgDaysToSell: multipliers.daysToSell,
    activeListingCount: multipliers.activeCount,
    avgActivePrice: Math.round(avgActivePrice * 100) / 100,
    sellThroughRate: multipliers.soldCount / (multipliers.soldCount + multipliers.activeCount),
    priceVolatility: Math.round(volatility * 1000) / 1000,
  };

  return {
    soldListings,
    activeListings,
    summary,
  };
}

function generateSoldListingsFromEstimate(
  low: number,
  mid: number,
  high: number,
  count: number,
  itemName: string
): SoldListing[] {
  const listings: SoldListing[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    // Use a distribution that clusters around mid but spans low to high
    const random = Math.random();
    let price: number;

    if (random < 0.15) {
      // 15% sell at low end
      price = low + (mid - low) * 0.3 * Math.random();
    } else if (random < 0.85) {
      // 70% sell around mid
      price = mid + (Math.random() - 0.5) * (high - low) * 0.4;
    } else {
      // 15% sell at high end
      price = mid + (high - mid) * (0.5 + 0.5 * Math.random());
    }

    // Ensure price stays within bounds
    price = Math.max(low * 0.9, Math.min(high * 1.1, price));

    const daysAgo = Math.floor(Math.random() * 30);

    listings.push({
      title: `${itemName} - Sold`,
      soldPrice: Math.round(price * 100) / 100,
      soldDate: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
      condition: ['Used - Like New', 'Used - Good', 'Used - Fair'][Math.floor(Math.random() * 3)],
      shippingCost: Math.random() > 0.5 ? 0 : Math.round(Math.random() * 12),
    });
  }

  return listings.sort((a, b) => b.soldDate.getTime() - a.soldDate.getTime());
}

function generateActiveListingsFromEstimate(
  mid: number,
  high: number,
  count: number,
  itemName: string
): ActiveListing[] {
  const listings: ActiveListing[] = [];

  for (let i = 0; i < count; i++) {
    // Active listings tend to be priced higher (optimistic sellers)
    const price = mid + (high - mid) * (0.2 + Math.random() * 0.8);

    listings.push({
      title: `${itemName} - Listed`,
      currentPrice: Math.round(price * 100) / 100,
      listingType: Math.random() > 0.7 ? 'auction' : 'buy-it-now',
      bids: Math.random() > 0.7 ? Math.floor(Math.random() * 10) : undefined,
      watchers: Math.floor(Math.random() * 25),
      condition: ['Used - Like New', 'Used - Good', 'Used - Fair'][Math.floor(Math.random() * 3)],
    });
  }

  return listings;
}
