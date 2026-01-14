'use server';

import { identifyItemWithGemini, identifyItemFromDescription } from '@/lib/api/gemini';
import { mockIdentifyItem, mockFetchMarketData, generateMarketDataFromAIEstimate } from '@/lib/mocks';
import { calculateVestScore } from '@/lib/vest';
import { ScanResult, MarketData, ItemIdentity, GeminiError } from '@/lib/types';

export interface ScanError {
  message: string;
  code: string;
  retryable: boolean;
  suggestTextInput: boolean;
}

export type ScanResponse =
  | { success: true; data: ScanResult }
  | { success: false; error: ScanError };

/**
 * Scan item from one or more images
 * Multiple images are analyzed together for better identification
 */
export async function scanItem(imageBase64: string | string[]): Promise<ScanResponse> {
  // Step 1: Identify the item using AI (real Gemini or mock)
  let itemIdentity: ItemIdentity;

  const hasApiKey = !!process.env.GOOGLE_AI_API_KEY;
  const imageCount = Array.isArray(imageBase64) ? imageBase64.length : 1;
  console.log('Gemini API key present:', hasApiKey, '| Images:', imageCount);

  if (hasApiKey) {
    try {
      console.log('Calling Gemini API with', imageCount, 'image(s)...');
      itemIdentity = await identifyItemWithGemini(imageBase64);
      console.log('Gemini response:', itemIdentity.name);
      if (itemIdentity.priceEstimate) {
        console.log('AI price estimate:', itemIdentity.priceEstimate.mid);
      }
    } catch (error) {
      console.error('Gemini API error:', error);

      // Handle GeminiError with user-friendly messages
      if (error instanceof GeminiError) {
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            retryable: error.retryable,
            suggestTextInput: error.code === 'UNIDENTIFIABLE' || error.code === 'PARSE_ERROR',
          },
        };
      }

      // Generic error fallback
      return {
        success: false,
        error: {
          message: 'Failed to analyze image. Please try again or describe the item manually.',
          code: 'UNKNOWN',
          retryable: true,
          suggestTextInput: true,
        },
      };
    }
  } else {
    console.log('No API key, using mock data');
    const firstImage = Array.isArray(imageBase64) ? imageBase64[0] : imageBase64;
    itemIdentity = await mockIdentifyItem(firstImage);
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
    success: true,
    data: {
      itemIdentity,
      marketData,
      vestScore,
    },
  };
}

/**
 * Re-identify an item using a text description
 * Used when the image identification was wrong or failed
 */
export async function identifyFromText(description: string): Promise<ScanResponse> {
  const hasApiKey = !!process.env.GOOGLE_AI_API_KEY;

  if (!hasApiKey) {
    return {
      success: false,
      error: {
        message: 'AI service not configured',
        code: 'API_KEY_MISSING',
        retryable: false,
        suggestTextInput: false,
      },
    };
  }

  try {
    console.log('Identifying from description:', description);
    const itemIdentity = await identifyItemFromDescription(description);
    console.log('Text identification result:', itemIdentity.name);

    // Generate market data from AI estimate
    let marketData: MarketData;
    if (itemIdentity.priceEstimate) {
      marketData = generateMarketDataFromAIEstimate(itemIdentity.priceEstimate, itemIdentity.name);
    } else {
      marketData = await mockFetchMarketData(itemIdentity.searchQuery);
    }

    // Calculate V.E.S.T. score
    const suggestedBuyPrice = Math.round(marketData.summary.medianSoldPrice * 0.4);
    const vestScore = calculateVestScore(marketData, { buyPrice: suggestedBuyPrice });

    return {
      success: true,
      data: {
        itemIdentity,
        marketData,
        vestScore,
      },
    };
  } catch (error) {
    console.error('Text identification error:', error);

    if (error instanceof GeminiError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          retryable: error.retryable,
          suggestTextInput: false,
        },
      };
    }

    return {
      success: false,
      error: {
        message: 'Failed to analyze description. Please try again.',
        code: 'UNKNOWN',
        retryable: true,
        suggestTextInput: false,
      },
    };
  }
}

export async function recalculateVest(
  marketDataJson: string,
  buyPrice: number
) {
  const marketData = JSON.parse(marketDataJson);
  return calculateVestScore(marketData, { buyPrice });
}
