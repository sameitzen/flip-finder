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

const IDENTIFICATION_PROMPT = `You are a conservative resale pricing expert. Your job is to identify items and estimate realistic eBay SOLD prices - NOT asking prices.

CRITICAL PRICING RULES:
1. ALWAYS estimate what items ACTUALLY SELL FOR, not what sellers ask
2. eBay sold prices are typically 20-40% below asking prices
3. When uncertain, estimate LOWER - it's better to be pleasantly surprised than disappointed
4. Common items sell for LESS than you think due to competition
5. Condition dramatically affects price - be honest about wear you see

Return ONLY valid JSON (no markdown, no backticks):
{
  "name": "Full product name with brand and model",
  "brand": "Brand name",
  "model": "Model number or name",
  "category": "Category > Subcategory > Type",
  "condition": "new|like-new|good|fair|poor",
  "confidence": 0.0 to 1.0,
  "searchQuery": "Optimized eBay search query for finding comparable SOLD listings",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "era": "Decade or 'Vintage' if applicable",
  "isPNWTreasure": true if Pacific Northwest brand (Filson, Pendleton, Pacific Stoneware, etc),
  "priceEstimate": {
    "low": quick-sale price (what it sells for in 1-3 days),
    "mid": realistic sold price (typical 7-14 day sale),
    "high": patient seller price (30+ day wait, perfect listing),
    "msrp": original retail if known (null otherwise),
    "confidence": 0.0 to 1.0,
    "reasoning": "Explain: What comparable items sell for? What affects this item's value?",
    "demandLevel": "high|medium|low",
    "redFlags": ["concerns: reproductions, damage, missing parts, oversaturated market"]
  }
}

CONDITION (be strict):
- new: Factory sealed, tags attached, never used
- like-new: Opened but unused, no wear whatsoever
- good: Light wear, minor signs of use, fully functional
- fair: Obvious wear, cosmetic issues, works fine
- poor: Heavy wear, may have issues

PRICING REALITY CHECK:
- Electronics depreciate 50-70% from MSRP within 2 years
- Used clothing typically sells for 10-30% of retail (except luxury/vintage)
- "Vintage" doesn't automatically mean valuable - demand matters
- Most household items sell for $5-20 regardless of original price
- Brand matters: Apple, Nike, specific collectibles hold value; generic brands don't
- Shipping costs eat into profit - factor this into realistic pricing

SEARCH QUERY RULES (CRITICAL for accurate eBay results):
- Keep queries SHORT and simple: "brand + product type + size" (e.g., "Stanley 40oz tumbler")
- NEVER include condition words (used, new, like-new, good, fair)
- NEVER include colors unless color is the primary identifier
- NEVER include subjective descriptors (beautiful, rare, vintage, nice)
- DO include: brand, model number/name, size if relevant
- Example: "Stanley Quencher 40oz" NOT "Stanley 40oz Quencher tumbler black used H2.0"

IMPORTANT: If image is unclear, provide best guess with low confidence. Only respond "Unidentifiable Item" if image is completely unreadable.`;

const TEXT_IDENTIFICATION_PROMPT = `You are a conservative resale pricing expert. Based on the user's item description, estimate realistic eBay SOLD prices.

CRITICAL: Estimate what items ACTUALLY SELL FOR, not asking prices. When uncertain, estimate LOWER.

Return ONLY valid JSON (no markdown):
{
  "name": "Full product name with brand and model",
  "brand": "Brand name",
  "model": "Model number or name",
  "category": "Category > Subcategory > Type",
  "condition": "new|like-new|good|fair|poor",
  "confidence": 0.0 to 1.0,
  "searchQuery": "eBay search query to find comparable SOLD listings",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "era": "Decade or 'Vintage' if applicable",
  "isPNWTreasure": true if Pacific Northwest brand,
  "priceEstimate": {
    "low": quick-sale price (1-3 days),
    "mid": realistic sold price (7-14 days),
    "high": patient seller price (30+ days),
    "msrp": original retail if known (null otherwise),
    "confidence": 0.0 to 1.0,
    "reasoning": "What comparable items actually sell for",
    "demandLevel": "high|medium|low",
    "redFlags": ["any concerns"]
  }
}

Assume "good" condition unless specified. Be conservative with prices - underselling is safer than overselling.`;

const PRICE_VALIDATION_PROMPT = `You are a pricing analyst. Given an item identification and real eBay listing data, determine the most accurate resale price.

You will receive:
1. Item name and AI's initial price estimate
2. Real eBay active listing prices for similar items
3. Number of active listings (market saturation indicator)

Your job: Triangulate these data sources to provide a FINAL realistic sold price estimate.

WEIGHTING RULES:
- If eBay has 10+ listings: Trust eBay data heavily (70-80% weight)
- If eBay has 5-9 listings: Balance both sources (50-50)
- If eBay has <5 listings: Lean on AI estimate but apply 20% discount for uncertainty
- If eBay prices are LOWER than AI: Trust eBay (market reality)
- If eBay prices are HIGHER than AI: Average them (eBay shows asking, not sold)

CRITICAL: Active listings show ASKING prices. Actual SOLD prices are typically 15-30% lower.

Return ONLY valid JSON:
{
  "finalEstimate": {
    "low": conservative quick-sale price,
    "mid": most likely sold price,
    "high": optimistic patient-seller price
  },
  "confidence": 0.0 to 1.0,
  "dataQuality": "high|medium|low",
  "reasoning": "How you weighted the sources and why",
  "marketInsight": "Brief market observation (saturated? rare? trending?)",
  "recommendation": "buy|maybe|pass"
}`;

export interface TriangulatedPrice {
  low: number;
  mid: number;
  high: number;
  confidence: number;
  dataQuality: 'high' | 'medium' | 'low';
  reasoning: string;
  marketInsight: string;
  recommendation: 'buy' | 'maybe' | 'pass';
}

/**
 * Validate and triangulate prices using AI analysis of eBay data + initial estimate
 */
export async function triangulatePrice(
  itemName: string,
  aiEstimate: { low: number; mid: number; high: number },
  ebayData: { avgPrice: number; minPrice: number; maxPrice: number; listingCount: number }
): Promise<TriangulatedPrice> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    // Fallback to simple weighted average if no API key
    return calculateFallbackTriangulation(aiEstimate, ebayData);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const dataPrompt = `
Item: ${itemName}

AI Initial Estimate:
- Low: $${aiEstimate.low}
- Mid: $${aiEstimate.mid}
- High: $${aiEstimate.high}

Real eBay Active Listings:
- Number of listings found: ${ebayData.listingCount}
- Average asking price: $${ebayData.avgPrice.toFixed(2)}
- Lowest asking price: $${ebayData.minPrice.toFixed(2)}
- Highest asking price: $${ebayData.maxPrice.toFixed(2)}

Analyze this data and provide the triangulated price estimate.`;

  try {
    const result = await withTimeout(
      model.generateContent([PRICE_VALIDATION_PROMPT, dataPrompt]),
      API_TIMEOUT_MS
    );
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      return calculateFallbackTriangulation(aiEstimate, ebayData);
    }

    // Parse response
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    return {
      low: Math.max(0, Number(parsed.finalEstimate?.low) || aiEstimate.low),
      mid: Math.max(0, Number(parsed.finalEstimate?.mid) || aiEstimate.mid),
      high: Math.max(0, Number(parsed.finalEstimate?.high) || aiEstimate.high),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      dataQuality: ['high', 'medium', 'low'].includes(parsed.dataQuality) ? parsed.dataQuality : 'medium',
      reasoning: parsed.reasoning || 'Price triangulated from AI and eBay data',
      marketInsight: parsed.marketInsight || '',
      recommendation: ['buy', 'maybe', 'pass'].includes(parsed.recommendation) ? parsed.recommendation : 'maybe',
    };
  } catch (error) {
    console.error('Price triangulation error:', error);
    return calculateFallbackTriangulation(aiEstimate, ebayData);
  }
}

/**
 * Fallback triangulation when AI is unavailable
 */
function calculateFallbackTriangulation(
  aiEstimate: { low: number; mid: number; high: number },
  ebayData: { avgPrice: number; minPrice: number; maxPrice: number; listingCount: number }
): TriangulatedPrice {
  // Weight eBay data based on listing count
  let ebayWeight: number;
  let dataQuality: 'high' | 'medium' | 'low';

  if (ebayData.listingCount >= 10) {
    ebayWeight = 0.75;
    dataQuality = 'high';
  } else if (ebayData.listingCount >= 5) {
    ebayWeight = 0.5;
    dataQuality = 'medium';
  } else if (ebayData.listingCount >= 1) {
    ebayWeight = 0.3;
    dataQuality = 'low';
  } else {
    // No eBay data, use AI with discount
    return {
      low: aiEstimate.low * 0.8,
      mid: aiEstimate.mid * 0.85,
      high: aiEstimate.high * 0.9,
      confidence: 0.4,
      dataQuality: 'low',
      reasoning: 'No eBay listings found - using AI estimate with conservative discount',
      marketInsight: 'Limited market data available',
      recommendation: 'maybe',
    };
  }

  const aiWeight = 1 - ebayWeight;

  // eBay shows asking prices, so apply 20% discount to estimate sold prices
  const ebayAdjusted = {
    low: ebayData.minPrice * 0.8,
    mid: ebayData.avgPrice * 0.8,
    high: ebayData.maxPrice * 0.85,
  };

  // Weighted combination
  const finalLow = (aiEstimate.low * aiWeight) + (ebayAdjusted.low * ebayWeight);
  const finalMid = (aiEstimate.mid * aiWeight) + (ebayAdjusted.mid * ebayWeight);
  const finalHigh = (aiEstimate.high * aiWeight) + (ebayAdjusted.high * ebayWeight);

  // Determine recommendation based on confidence and margin
  let recommendation: 'buy' | 'maybe' | 'pass' = 'maybe';
  if (dataQuality === 'high' && ebayData.listingCount > 15) {
    recommendation = 'buy'; // Good data confidence
  } else if (ebayData.listingCount < 3) {
    recommendation = 'pass'; // Too risky
  }

  return {
    low: Math.round(finalLow * 100) / 100,
    mid: Math.round(finalMid * 100) / 100,
    high: Math.round(finalHigh * 100) / 100,
    confidence: ebayWeight + 0.2,
    dataQuality,
    reasoning: `Weighted ${Math.round(ebayWeight * 100)}% eBay data, ${Math.round(aiWeight * 100)}% AI estimate. eBay prices adjusted -20% for asking vs sold difference.`,
    marketInsight: ebayData.listingCount > 20 ? 'High supply - competitive market' : ebayData.listingCount < 5 ? 'Low supply - could indicate low demand or rarity' : 'Moderate market activity',
    recommendation,
  };
}

/**
 * Identify an item from one or more images
 * When multiple images are provided, Gemini will analyze all of them together
 * to get a more accurate identification (e.g., front, back, bottom of an item)
 */
export async function identifyItemWithGemini(imageBase64: string | string[]): Promise<ItemIdentity> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new GeminiError('GOOGLE_AI_API_KEY not configured', 'API_KEY_MISSING', false);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Normalize to array
  const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64];

  // Create image parts for all images
  const imageParts = images.map((img, index) => {
    const base64Data = img.includes(',') ? img.split(',')[1] : img;
    return {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg',
      },
    };
  });

  // Build the prompt - adjust for multiple images
  const prompt = images.length > 1
    ? `${IDENTIFICATION_PROMPT}\n\nYou are being shown ${images.length} images of the same item from different angles. Use ALL images together to identify the item more accurately. Look for brand markings, model numbers, condition details, and any text visible across all photos.`
    : IDENTIFICATION_PROMPT;

  try {
    const result = await withTimeout(
      model.generateContent([prompt, ...imageParts]),
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
