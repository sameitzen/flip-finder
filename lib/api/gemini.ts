'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ItemIdentity, ConditionEstimate } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

const IDENTIFICATION_PROMPT = `You are an expert reseller's assistant. Analyze this image and identify the item for resale on eBay.

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
  "isPNWTreasure": true if Pacific Northwest brand (Filson, Pendleton, Pacific Stoneware, etc)
}

Condition guidelines:
- new: Sealed, unused, with tags
- like-new: Opened but barely used, no visible wear
- good: Light wear, fully functional
- fair: Moderate wear, some cosmetic issues
- poor: Heavy wear, may need repair

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
    };
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('Failed to parse item identification response');
  }
}
