'use server';

import { identifyItemWithGemini } from '@/lib/api/gemini';
import { mockIdentifyItem, mockFetchMarketData } from '@/lib/mocks';
import { calculateVestScore } from '@/lib/vest';
import { ScanResult } from '@/lib/types';

export async function scanItem(imageBase64: string): Promise<ScanResult> {
  // Step 1: Identify the item using AI (real Gemini or mock)
  let itemIdentity;

  if (process.env.GOOGLE_AI_API_KEY) {
    try {
      itemIdentity = await identifyItemWithGemini(imageBase64);
    } catch (error) {
      console.error('Gemini API error, falling back to mock:', error);
      itemIdentity = await mockIdentifyItem(imageBase64);
    }
  } else {
    itemIdentity = await mockIdentifyItem(imageBase64);
  }

  // Step 2: Fetch market data based on search query
  // TODO: Replace with real eBay API when configured
  const marketData = await mockFetchMarketData(itemIdentity.searchQuery);

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
