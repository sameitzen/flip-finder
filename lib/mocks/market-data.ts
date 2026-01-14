import { MarketData, MarketSummary, SoldListing, ActiveListing } from '@/lib/types';

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
