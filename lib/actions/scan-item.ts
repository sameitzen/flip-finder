'use server';

import { identifyItemWithGemini } from '@/lib/api/gemini';
import { mockIdentifyItem, mockFetchMarketData, generateMarketDataFromAIEstimate } from '@/lib/mocks';
import { calculateVestScore } from '@/lib/vest';
import { ScanResult, MarketData } from '@/lib/types';

export async function scanItem(imageBase64: string): Promise<ScanResult> {
  // Step 1: Identify the item using AI (real Gemini or mock)
  let itemIdentity;

  const hasApiKey = !!process.env.GOOGLE_AI_API_KEY;
  console.log('Gemini API key present:', hasApiKey);

  if (hasApiKey) {
    try {
      console.log('Calling Gemini API...');
      itemIdentity = await identifyItemWithGemini(imageBase64);
      console.log('Gemini response:', itemIdentity.name);
      if (itemIdentity.priceEstimate) {
        console.log('AI price estimate:', itemIdentity.priceEstimate.mid);
      }
    } catch (error) {
      console.error('Gemini API error, falling back to mock:', error);
      itemIdentity = await mockIdentifyItem(imageBase64);
    }
  } else {
    console.log('No API key, using mock data');
    itemIdentity = await mockIdentifyItem(imageBase64);
  }

  // Step 2: Fetch market data
  // If we have AI price estimates, use those to generate realistic market data
  // TODO: Replace with real eBay API when configured
  let marketData: MarketData;

  if (itemIdentity.priceEstimate) {
    // Use AI-powered estimates to generate market data
    marketData = generateMarketDataFromAIEstimate(itemIdentity.priceEstimate, itemIdentity.name);
    console.log('Using AI-generated market data');
  } else {
    // Fall back to mock data
    marketData = await mockFetchMarketData(itemIdentity.searchQuery);
    console.log('Using mock market data');
  }

  // Step 3: Calculate initial V.E.S.T. score with suggested buy price
  const suggestedBuyPrice = Math.round(marketData.summary.medianSoldPrice * 0.4);
  const vestScore = calculateVestScore(marketData, { buyPrice: suggestedBuyPrice });

  return {
    itemIdentity,
    marketData,
    vestScore,
  };
}

export async function recalculateVest(
  marketDataJson: string,
  buyPrice: number
) {
  const marketData = JSON.parse(marketDataJson);
  return calculateVestScore(marketData, { buyPrice });
}
