'use server';

import { MarketData, SoldListing, ActiveListing, MarketSummary } from '@/lib/types';

const EBAY_API_BASE = 'https://api.ebay.com';

// Cache for OAuth token
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth token for eBay API
 * Uses client credentials grant for application-level access
 */
async function getEbayToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('eBay API credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('eBay OAuth error:', error);
    throw new Error('Failed to authenticate with eBay API');
  }

  const data = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

interface EbaySearchResponse {
  itemSummaries?: Array<{
    itemId: string;
    title: string;
    price: { value: string; currency: string };
    image?: { imageUrl: string };
    condition?: string;
    itemWebUrl: string;
    seller?: { username: string; feedbackPercentage: string };
  }>;
  total?: number;
}

/**
 * Search for sold/completed listings on eBay
 * Note: Browse API doesn't directly support sold listings filter,
 * so we search active listings and use AI estimates for sold data
 */
export async function searchEbayListings(
  searchQuery: string,
  options: { limit?: number } = {}
): Promise<{ active: ActiveListing[]; totalActive: number }> {
  const token = await getEbayToken();
  const limit = options.limit || 50;

  // Search active listings
  const searchParams = new URLSearchParams({
    q: searchQuery,
    limit: limit.toString(),
    sort: 'price',
  });

  const response = await fetch(
    `${EBAY_API_BASE}/buy/browse/v1/item_summary/search?${searchParams}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('eBay search error:', response.status, error);
    throw new Error(`eBay API error: ${response.status}`);
  }

  const data: EbaySearchResponse = await response.json();

  const activeListings: ActiveListing[] = (data.itemSummaries || []).map((item) => ({
    title: item.title,
    currentPrice: parseFloat(item.price.value),
    listingType: 'buy-it-now' as const,
    watchers: 0,
    condition: item.condition || 'Used',
    imageUrl: item.image?.imageUrl,
  }));

  return {
    active: activeListings,
    totalActive: data.total || activeListings.length,
  };
}

/**
 * Fetch market data for an item, combining eBay active listings
 * with AI-estimated sold data
 */
export async function fetchEbayMarketData(
  searchQuery: string,
  aiEstimate?: { low: number; mid: number; high: number }
): Promise<MarketData> {
  try {
    console.log('Fetching eBay data for:', searchQuery);
    const { active, totalActive } = await searchEbayListings(searchQuery, { limit: 50 });

    // Calculate active listing stats
    const activePrices = active.map(l => l.currentPrice).filter(p => p > 0);
    const avgActivePrice = activePrices.length > 0
      ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length
      : aiEstimate?.mid || 0;

    // Generate estimated sold listings based on AI prices and active listing patterns
    const soldListings = generateEstimatedSoldListings(
      aiEstimate?.mid || avgActivePrice,
      aiEstimate?.low || avgActivePrice * 0.7,
      aiEstimate?.high || avgActivePrice * 1.3,
      searchQuery
    );

    // Calculate summary stats
    const soldPrices = soldListings.map(l => l.soldPrice);
    const avgSoldPrice = soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length;
    const sortedPrices = [...soldPrices].sort((a, b) => a - b);
    const medianSoldPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

    const summary: MarketSummary = {
      avgSoldPrice: Math.round(avgSoldPrice * 100) / 100,
      medianSoldPrice: Math.round(medianSoldPrice * 100) / 100,
      minSoldPrice: Math.min(...soldPrices),
      maxSoldPrice: Math.max(...soldPrices),
      totalSold30Days: Math.min(soldListings.length, 15),
      totalSold90Days: soldListings.length,
      avgDaysToSell: calculateAvgDaysToSell(soldListings),
      activeListingCount: totalActive,
      avgActivePrice: Math.round(avgActivePrice * 100) / 100,
      sellThroughRate: calculateSellThroughRate(soldListings.length, totalActive),
      priceVolatility: calculatePriceVolatility(soldPrices),
    };

    console.log('eBay market data:', {
      activeListings: active.length,
      avgActivePrice,
      estimatedMedianSold: medianSoldPrice,
    });

    return {
      soldListings,
      activeListings: active,
      summary,
    };
  } catch (error) {
    console.error('Error fetching eBay market data:', error);
    throw error;
  }
}

/**
 * Generate estimated sold listings based on price estimates
 * This simulates what sold data would look like based on AI price estimates
 */
function generateEstimatedSoldListings(
  midPrice: number,
  lowPrice: number,
  highPrice: number,
  searchQuery: string
): SoldListing[] {
  const listings: SoldListing[] = [];
  const now = new Date();

  // Generate 15-25 simulated sold listings
  const count = 15 + Math.floor(Math.random() * 10);

  for (let i = 0; i < count; i++) {
    // Price distribution: mostly around mid, some low, few high
    let price: number;
    const rand = Math.random();
    if (rand < 0.2) {
      // 20% at low end
      price = lowPrice + (midPrice - lowPrice) * Math.random() * 0.3;
    } else if (rand < 0.85) {
      // 65% around mid
      price = midPrice * (0.85 + Math.random() * 0.3);
    } else {
      // 15% at high end
      price = midPrice + (highPrice - midPrice) * (0.5 + Math.random() * 0.5);
    }

    // Random date within last 90 days
    const daysAgo = Math.floor(Math.random() * 90);
    const soldDate = new Date(now);
    soldDate.setDate(soldDate.getDate() - daysAgo);

    listings.push({
      title: searchQuery,
      soldPrice: Math.round(price * 100) / 100,
      soldDate,
      condition: ['Used', 'Like New', 'Good', 'Very Good'][Math.floor(Math.random() * 4)],
      shippingCost: Math.round((5 + Math.random() * 10) * 100) / 100, // Estimated shipping $5-15
    });
  }

  return listings.sort((a, b) => b.soldDate.getTime() - a.soldDate.getTime());
}

function calculateAvgDaysToSell(listings: SoldListing[]): number {
  // Estimate avg days to sell based on price distribution and market activity
  // More listings = faster sales, higher prices = slower sales
  if (listings.length === 0) return 7;
  const avgPrice = listings.reduce((sum, l) => sum + l.soldPrice, 0) / listings.length;
  // Base estimate: 5-14 days, adjusted by volume
  const volumeFactor = Math.min(1, listings.length / 20); // More volume = faster
  const baseDays = 10 - (volumeFactor * 5); // 5-10 days base
  return Math.round(baseDays + (avgPrice / 100)); // Add ~1 day per $100
}

function calculateSellThroughRate(sold: number, active: number): number {
  if (sold + active === 0) return 0.5;
  return Math.round((sold / (sold + active)) * 100) / 100;
}

function calculatePriceVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  return Math.round((stdDev / mean) * 100) / 100;
}

/**
 * Check if eBay API is configured
 */
export async function isEbayConfigured(): Promise<boolean> {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}
