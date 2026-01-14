'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ItemIdentity, ConditionEstimate, AIPriceEstimate, GeminiError } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Timeout wrapper for API calls
const API_TIMEOUT_MS = 30000; // 30 seconds

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    ),
  ]);
}

const IDENTIFICATION_PROMPT = `You are an expert reseller's assistant with deep knowledge of eBay market values. Analyze this image and identify the item for resale.

Return ONLY a valid JSON object with this exact structure (no markdown, no backticks, just the JSON):
{
  "name": "Full product name with brand and model",
  "brand": "Brand name",
  "model": "Model number or name",
  "category": "Category > Subcategory > Type",
  "condition": "new|like-new|good|fair|poor",
  "confidence": 0.0 to 1.0,
  "searchQuery": "Optimized eBay search query",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "era": "Decade or 'Vintage' if applicable",
  "isPNWTreasure": true if Pacific Northwest brand (Filson, Pendleton, Pacific Stoneware, etc),
  "priceEstimate": {
    "low": lowest realistic selling price in USD,
    "mid": most likely selling price in USD,
    "high": best-case selling price in USD,
    "msrp": original retail price in USD if known (null if unknown or vintage/discontinued),
    "confidence": 0.0 to 1.0 (how confident you are in this estimate),
    "reasoning": "Brief explanation of price factors",
    "demandLevel": "high|medium|low",
    "redFlags": ["any concerns like reproduction, damage, missing parts"]
  }
}

Condition guidelines:
- new: Sealed, unused, with tags
- like-new: Opened but barely used, no visible wear
- good: Light wear, fully functional
- fair: Moderate wear, some cosmetic issues
- poor: Heavy wear, may need repair

Price estimation guidelines:
- Base estimates on typical eBay sold prices for this exact item in this condition
- Consider brand reputation, rarity, collectibility, and current demand
- Low price = quick sale / poor photos / competitive market
- Mid price = typical well-listed item
- High price = patient seller / exceptional condition / rare variant
- For vintage/collectible items, factor in age and desirability
- For common items, prices are usually lower due to competition

Be specific with the search query - include brand, model, color, size if visible.
For vintage items, include the era. For PNW brands from Washington/Oregon, set isPNWTreasure to true.

IMPORTANT: If you cannot clearly identify the item from the image, still provide your best guess with a low confidence score (below 0.5). Only if the image is completely unreadable (e.g., completely dark, blurry beyond recognition, not showing any product) should you respond with a name of "Unidentifiable Item" and confidence of 0.`;

const TEXT_IDENTIFICATION_PROMPT = `You are an expert reseller's assistant with deep knowledge of eBay market values. The user will describe an item they want to resell. Based on this description, provide market analysis.

Return ONLY a valid JSON object with this exact structure (no markdown, no backticks, just the JSON):
{
  "name": "Full product name with brand and model based on description",
  "brand": "Brand name",
  "model": "Model number or name",
  "category": "Category > Subcategory > Type",
  "condition": "new|like-new|good|fair|poor",
  "confidence": 0.0 to 1.0,
  "searchQuery": "Optimized eBay search query",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "era": "Decade or 'Vintage' if applicable",
  "isPNWTreasure": true if Pacific Northwest brand (Filson, Pendleton, Pacific Stoneware, etc),
  "priceEstimate": {
    "low": lowest realistic selling price in USD,
    "mid": most likely selling price in USD,
    "high": best-case selling price in USD,
    "msrp": original retail price in USD if known (null if unknown or vintage/discontinued),
    "confidence": 0.0 to 1.0 (how confident you are in this estimate),
    "reasoning": "Brief explanation of price factors",
    "demandLevel": "high|medium|low",
    "redFlags": ["any concerns like reproduction, damage, missing parts"]
  }
}

Since you're working from a description (not an image), assume "good" condition unless specified.
Set confidence based on how specific the user's description is.
Be realistic with price estimates based on typical eBay sold prices.`;

export async function identifyItemWithGemini(imageBase64: string): Promise<ItemIdentity> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new GeminiError('GOOGLE_AI_API_KEY not configured', 'API_KEY_MISSING', false);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Extract the base64 data (remove data URL prefix if present)
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: 'image/jpeg',
    },
  };

  try {
    const result = await withTimeout(
      model.generateContent([IDENTIFICATION_PROMPT, imagePart]),
      API_TIMEOUT_MS
    );
    const response = await result.response;
    const text = response.text();

    // Check for empty response (can happen with content policy blocks)
    if (!text || text.trim().length === 0) {
      console.error('Gemini returned empty response - possible content policy block');
      throw new GeminiError(
        'Could not analyze this image. Try describing the item instead.',
        'UNIDENTIFIABLE',
        false
      );
    }

    return parseGeminiResponse(text);
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini image identification error:', message);

    // Handle timeout
    if (message.includes('timed out') || message.includes('timeout')) {
      throw new GeminiError('Request took too long. Please try again.', 'NETWORK_ERROR', true);
    }
    // Handle specific error types
    if (message.includes('quota') || message.includes('rate') || message.includes('429')) {
      throw new GeminiError('Too many requests. Please wait a moment and try again.', 'RATE_LIMIT', true);
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('ECONNREFUSED')) {
      throw new GeminiError('Network error. Please check your connection.', 'NETWORK_ERROR', true);
    }
    if (message.includes('parse') || message.includes('JSON')) {
      throw new GeminiError('Failed to understand the response. Please try again.', 'PARSE_ERROR', true);
    }
    // Handle content policy / safety blocks
    if (message.includes('SAFETY') || message.includes('blocked') || message.includes('policy')) {
      throw new GeminiError(
        'Could not analyze this image. Try describing the item instead.',
        'UNIDENTIFIABLE',
        false
      );
    }

    throw new GeminiError(
      'Failed to analyze image. Try taking a clearer photo or describe the item manually.',
      'UNKNOWN',
      true
    );
  }
}

// Helper function to parse Gemini response
function parseGeminiResponse(text: string): ItemIdentity {
  // Clean up the response - sometimes Gemini wraps in markdown code blocks
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const parsed = JSON.parse(jsonStr);

  // Check for unidentifiable response
  if (parsed.name === 'Unidentifiable Item' || parsed.confidence === 0) {
    throw new GeminiError(
      'Could not identify the item from the image. Try taking a clearer photo or describe it manually.',
      'UNIDENTIFIABLE',
      false
    );
  }

  // Validate and normalize the response
  const validConditions: ConditionEstimate[] = ['new', 'like-new', 'good', 'fair', 'poor'];
  const condition = validConditions.includes(parsed.condition)
    ? parsed.condition
    : 'good';

  // Parse price estimate if provided
  let priceEstimate: AIPriceEstimate | undefined;
  if (parsed.priceEstimate) {
    const pe = parsed.priceEstimate;
    const validDemandLevels = ['high', 'medium', 'low'] as const;
    priceEstimate = {
      low: Math.max(0, Number(pe.low) || 0),
      mid: Math.max(0, Number(pe.mid) || 0),
      high: Math.max(0, Number(pe.high) || 0),
      msrp: pe.msrp && Number(pe.msrp) > 0 ? Number(pe.msrp) : undefined,
      confidence: Math.min(1, Math.max(0, Number(pe.confidence) || 0.5)),
      reasoning: pe.reasoning || 'No reasoning provided',
      demandLevel: validDemandLevels.includes(pe.demandLevel) ? pe.demandLevel : 'medium',
      redFlags: Array.isArray(pe.redFlags) ? pe.redFlags : undefined,
    };
  }

  return {
    name: parsed.name || 'Unknown Item',
    brand: parsed.brand || 'Unknown',
    model: parsed.model || '',
    category: parsed.category || 'Other',
    condition,
    confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
    searchQuery: parsed.searchQuery || parsed.name || 'item',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    era: parsed.era,
    isPNWTreasure: Boolean(parsed.isPNWTreasure),
    priceEstimate,
  };
}

/**
 * Identify an item using a text description instead of an image
 */
export async function identifyItemFromDescription(description: string): Promise<ItemIdentity> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new GeminiError('GOOGLE_AI_API_KEY not configured', 'API_KEY_MISSING', false);
  }

  if (!description || description.trim().length < 3) {
    throw new GeminiError('Please provide a more detailed description', 'UNIDENTIFIABLE', false);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  try {
    const result = await withTimeout(
      model.generateContent([
        TEXT_IDENTIFICATION_PROMPT,
        `User's item description: ${description.trim()}`
      ]),
      API_TIMEOUT_MS
    );
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new GeminiError('Could not analyze description. Please try again.', 'PARSE_ERROR', true);
    }

    return parseGeminiResponse(text);
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini text identification error:', message);

    if (message.includes('timed out') || message.includes('timeout')) {
      throw new GeminiError('Request took too long. Please try again.', 'NETWORK_ERROR', true);
    }
    if (message.includes('quota') || message.includes('rate')) {
      throw new GeminiError('Too many requests. Please wait a moment and try again.', 'RATE_LIMIT', true);
    }
    if (message.includes('network') || message.includes('fetch')) {
      throw new GeminiError('Network error. Please check your connection.', 'NETWORK_ERROR', true);
    }

    throw new GeminiError('Failed to analyze item description', 'UNKNOWN', true);
  }
}
