'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ItemIdentity, ConditionEstimate, AIPriceEstimate } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

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
For vintage items, include the era. For PNW brands from Washington/Oregon, set isPNWTreasure to true.`;

export async function identifyItemWithGemini(imageBase64: string): Promise<ItemIdentity> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
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

  const result = await model.generateContent([IDENTIFICATION_PROMPT, imagePart]);
  const response = await result.response;
  const text = response.text();

  // Parse the JSON response
  try {
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
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Failed to parse item identification response');
  }
}
