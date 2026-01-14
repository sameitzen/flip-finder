'use server';

import { mockIdentifyItem, mockFetchMarketData } from '@/lib/mocks';
import { calculateVestScore } from '@/lib/vest';
import { ScanResult } from '@/lib/types';

export async function scanItem(imageBase64: string): Promise<ScanResult> {
  // Step 1: Identify the item using AI
  const itemIdentity = await mockIdentifyItem(imageBase64);

  // Step 2: Fetch market data based on search query
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
