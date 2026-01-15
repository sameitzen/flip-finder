'use server';

import { identifyItemWithGemini, identifyItemFromDescription } from '@/lib/api/gemini';
import { fetchEbayMarketData, isEbayConfigured } from '@/lib/api/ebay';
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
  const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64];
  const imageCount = images.length;

  // Log image sizes for debugging
  const imageSizes = images.map(img => Math.round(img.length / 1024));
  console.log('Gemini API key present:', hasApiKey, '| Images:', imageCount, '| Sizes (KB):', imageSizes);

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
  let marketData: MarketData;

  // Try eBay API first if configured - this now triangulates AI + eBay data
  if (await isEbayConfigured()) {
    try {
      console.log('Fetching eBay market data with triangulation...');
      marketData = await fetchEbayMarketData(
        itemIdentity.searchQuery,
        itemIdentity.name,
        itemIdentity.priceEstimate
          ? { low: itemIdentity.priceEstimate.low, mid: itemIdentity.priceEstimate.mid, high: itemIdentity.priceEstimate.high }
          : undefined
      );
      console.log('Using triangulated eBay + AI market data');
    } catch (ebayError) {
      console.error('eBay API error, falling back:', ebayError);
      // Fall back to AI estimates or mock data
      if (itemIdentity.priceEstimate) {
        marketData = generateMarketDataFromAIEstimate(itemIdentity.priceEstimate, itemIdentity.name);
        console.log('Using AI-generated market data (eBay fallback)');
      } else {
        marketData = await mockFetchMarketData(itemIdentity.searchQuery);
        console.log('Using mock market data (eBay fallback)');
      }
    }
  } else if (itemIdentity.priceEstimate) {
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

    // Fetch market data - try eBay first with triangulation
    let marketData: MarketData;
    if (await isEbayConfigured()) {
      try {
        marketData = await fetchEbayMarketData(
          itemIdentity.searchQuery,
          itemIdentity.name,
          itemIdentity.priceEstimate
            ? { low: itemIdentity.priceEstimate.low, mid: itemIdentity.priceEstimate.mid, high: itemIdentity.priceEstimate.high }
            : undefined
        );
      } catch {
        marketData = itemIdentity.priceEstimate
          ? generateMarketDataFromAIEstimate(itemIdentity.priceEstimate, itemIdentity.name)
          : await mockFetchMarketData(itemIdentity.searchQuery);
      }
    } else if (itemIdentity.priceEstimate) {
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
