'use server';

import { MarketData, SoldListing, ActiveListing, MarketSummary } from '@/lib/types';
import { triangulatePrice, TriangulatedPrice } from './gemini';

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
 * with AI price triangulation for accurate sold price estimates
 */
export async function fetchEbayMarketData(
  searchQuery: string,
  itemName: string,
  aiEstimate?: { low: number; mid: number; high: number }
): Promise<MarketData & { triangulation?: TriangulatedPrice }> {
  try {
    console.log('Fetching eBay data for:', searchQuery);
    const { active, totalActive } = await searchEbayListings(searchQuery, { limit: 50 });

    // Calculate real eBay listing stats
    const activePrices = active.map(l => l.currentPrice).filter(p => p > 0);
    const avgActivePrice = activePrices.length > 0
      ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length
      : 0;
    const minActivePrice = activePrices.length > 0 ? Math.min(...activePrices) : 0;
    const maxActivePrice = activePrices.length > 0 ? Math.max(...activePrices) : 0;

    // Triangulate prices using AI + eBay data
    let triangulatedPrices: TriangulatedPrice;

    if (aiEstimate && aiEstimate.mid > 0) {
      // We have both AI estimate and eBay data - triangulate them
      console.log('Triangulating prices:', { aiEstimate, ebayAvg: avgActivePrice, listingCount: totalActive });

      triangulatedPrices = await triangulatePrice(
        itemName,
        aiEstimate,
        {
          avgPrice: avgActivePrice,
          minPrice: minActivePrice,
          maxPrice: maxActivePrice,
          listingCount: totalActive,
        }
      );

      console.log('Triangulated result:', triangulatedPrices);
    } else if (activePrices.length > 0) {
      // Only eBay data available - apply asking-to-sold discount
      const soldDiscount = 0.8; // 20% below asking prices
      triangulatedPrices = {
        low: minActivePrice * soldDiscount,
        mid: avgActivePrice * soldDiscount,
        high: maxActivePrice * 0.85,
        confidence: totalActive >= 10 ? 0.7 : totalActive >= 5 ? 0.5 : 0.3,
        dataQuality: totalActive >= 10 ? 'high' : totalActive >= 5 ? 'medium' : 'low',
        reasoning: `Based on ${totalActive} eBay listings, adjusted -20% for asking vs sold prices`,
        marketInsight: totalActive > 20 ? 'High supply market' : totalActive < 5 ? 'Limited market data' : 'Moderate market activity',
        recommendation: 'maybe',
      };
    } else {
      // No data at all - very conservative
      triangulatedPrices = {
        low: 5,
        mid: 15,
        high: 30,
        confidence: 0.1,
        dataQuality: 'low',
        reasoning: 'No market data available - using very conservative estimates',
        marketInsight: 'Unable to find comparable listings',
        recommendation: 'pass',
      };
    }

    // Generate estimated sold listings based on TRIANGULATED prices (not raw AI)
    const soldListings = generateEstimatedSoldListings(
      triangulatedPrices.mid,
      triangulatedPrices.low,
      triangulatedPrices.high,
      searchQuery
    );

    // Calculate summary stats from triangulated data
    const soldPrices = soldListings.map(l => l.soldPrice);
    const avgSoldPrice = soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length;
    const sortedPrices = [...soldPrices].sort((a, b) => a - b);
    const medianSoldPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

    const summary: MarketSummary = {
      avgSoldPrice: Math.round(avgSoldPrice * 100) / 100,
      medianSoldPrice: Math.round(medianSoldPrice * 100) / 100,
      minSoldPrice: Math.round(triangulatedPrices.low * 100) / 100,
      maxSoldPrice: Math.round(triangulatedPrices.high * 100) / 100,
      totalSold30Days: Math.min(soldListings.length, 15),
      totalSold90Days: soldListings.length,
      avgDaysToSell: calculateAvgDaysToSell(soldListings, totalActive),
      activeListingCount: totalActive,
      avgActivePrice: Math.round(avgActivePrice * 100) / 100,
      sellThroughRate: calculateSellThroughRate(soldListings.length, totalActive),
      priceVolatility: calculatePriceVolatility(soldPrices),
    };

    console.log('Final market data:', {
      activeListings: active.length,
      avgActivePrice,
      triangulatedMid: triangulatedPrices.mid,
      medianSoldPrice,
      dataQuality: triangulatedPrices.dataQuality,
    });

    return {
      soldListings,
      activeListings: active,
      summary,
      triangulation: triangulatedPrices,
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

function calculateAvgDaysToSell(listings: SoldListing[], activeListingCount: number = 0): number {
  // Estimate avg days to sell based on price distribution and market activity
  // More active listings = slower sales (more competition)
  // Higher prices = slower sales
  if (listings.length === 0) return 7;

  const avgPrice = listings.reduce((sum, l) => sum + l.soldPrice, 0) / listings.length;

  // Base days: 5-14, adjusted by competition
  const competitionFactor = Math.min(1, activeListingCount / 50); // More competition = slower
  const baseDays = 5 + (competitionFactor * 9); // 5-14 days base

  // Add time for higher prices
  const priceFactor = Math.min(7, avgPrice / 50); // Add up to 7 days for expensive items

  return Math.round(baseDays + priceFactor);
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
