/**
 * Keyword Broadener
 *
 * Implements progressive query relaxation to ensure eBay searches
 * return sufficient results for accurate pricing.
 *
 * Tier 1: Full query (as-is from Gemini)
 * Tier 2: Core query (brand + model + size, no condition/color)
 * Tier 3: Base query (brand + product type only)
 */

export interface BroadenResult {
  query: string;
  tier: 1 | 2 | 3;
  confidence: number;
  strippedTerms: string[];
}

// Condition words to strip in Tier 2
const CONDITION_WORDS = [
  'mint', 'excellent', 'good', 'fair', 'poor', 'used', 'new',
  'like new', 'like-new', 'refurbished', 'damaged', 'broken', 'working',
  'tested', 'untested', 'for parts', 'as is', 'as-is', 'minor scratches',
  'major scratches', 'pristine', 'sealed', 'opened', 'nib', 'nwt', 'nwot',
  'pre-owned', 'preowned', 'gently used', 'well used', 'barely used',
  'light wear', 'heavy wear', 'slight wear', 'some wear', 'wear',
  'scuffs', 'scratches', 'dents', 'dings', 'chips', 'cracks',
  'complete', 'incomplete', 'missing', 'with box', 'no box', 'boxed',
];

// Color words to strip in Tier 2
const COLOR_WORDS = [
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange',
  'purple', 'pink', 'brown', 'gray', 'grey', 'silver', 'gold',
  'matte', 'glossy', 'metallic', 'chrome', 'rose gold', 'space gray',
  'space grey', 'midnight', 'starlight', 'graphite', 'bronze', 'copper',
  'navy', 'beige', 'cream', 'ivory', 'tan', 'burgundy', 'maroon',
  'teal', 'turquoise', 'coral', 'salmon', 'olive', 'forest', 'sage',
  'multi', 'multicolor', 'multi-color', 'rainbow', 'clear', 'transparent',
];

// Subjective/marketing words to strip
const SUBJECTIVE_WORDS = [
  'vintage', 'antique', 'rare', 'collectible', 'limited edition',
  'special edition', 'authentic', 'genuine', 'original', 'retro',
  'classic', 'modern', 'unique', 'beautiful', 'gorgeous', 'amazing',
  'stunning', 'elegant', 'luxury', 'premium', 'high end', 'high-end',
  'designer', 'exclusive', 'htf', 'hard to find', 'discontinued',
  'sold out', 'must have', 'must-have', 'iconic', 'legendary',
  'professional', 'pro', 'flagship', 'top of the line',
];

// Material words to strip in Tier 3
const MATERIAL_WORDS = [
  'stainless', 'steel', 'aluminum', 'aluminium', 'plastic', 'ceramic',
  'glass', 'leather', 'faux leather', 'vegan leather', 'fabric', 'cotton',
  'polyester', 'wood', 'wooden', 'metal', 'rubber', 'silicone',
  'titanium', 'carbon', 'carbon fiber', 'bamboo', 'marble', 'granite',
  'crystal', 'porcelain', 'enamel', 'brass', 'copper', 'zinc',
  'nylon', 'mesh', 'suede', 'velvet', 'satin', 'silk', 'linen',
];

// Size/capacity patterns to strip in Tier 3
const SIZE_PATTERNS = [
  /\b\d+\s*(oz|ml|l|lb|kg|g|inch|in|"|cm|mm|m|ft|qt|gal)\b/gi,
  /\b(small|medium|large|xl|xxl|xs|s|m|l)\b/gi,
  /\b\d+["']?\s*x\s*\d+["']?(\s*x\s*\d+["']?)?\b/gi, // dimensions like 12x8
  /\b\d+\s*(pack|pc|pcs|pieces?|count|ct)\b/gi,
];

/**
 * Create word boundary regex that handles hyphenated words
 */
function createWordRegex(word: string): RegExp {
  // Escape special regex characters
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

/**
 * Strip a list of words from a query
 */
function stripWords(query: string, words: string[], stripped: string[]): string {
  let result = query.toLowerCase();

  // Sort by length descending to match longer phrases first
  const sortedWords = [...words].sort((a, b) => b.length - a.length);

  for (const word of sortedWords) {
    const regex = createWordRegex(word);
    if (regex.test(result)) {
      stripped.push(word);
      result = result.replace(regex, ' ');
    }
  }

  return result;
}

/**
 * Generate progressively broader search queries
 */
export function broadenQuery(originalQuery: string): BroadenResult[] {
  const results: BroadenResult[] = [];

  // Tier 1: Original query (cleaned up)
  const tier1Query = originalQuery
    .replace(/\s+/g, ' ')
    .trim();

  results.push({
    query: tier1Query,
    tier: 1,
    confidence: 1.0,
    strippedTerms: [],
  });

  // Tier 2: Strip condition, color, subjective terms
  const tier2Stripped: string[] = [];
  let tier2Query = stripWords(tier1Query, CONDITION_WORDS, tier2Stripped);
  tier2Query = stripWords(tier2Query, COLOR_WORDS, tier2Stripped);
  tier2Query = stripWords(tier2Query, SUBJECTIVE_WORDS, tier2Stripped);

  // Clean up extra spaces and punctuation
  tier2Query = tier2Query
    .replace(/[,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Only add Tier 2 if it's meaningfully different and has content
  if (
    tier2Query.length > 5 &&
    tier2Query.toLowerCase() !== tier1Query.toLowerCase() &&
    tier2Stripped.length > 0
  ) {
    results.push({
      query: tier2Query,
      tier: 2,
      confidence: 0.85,
      strippedTerms: tier2Stripped,
    });
  }

  // Tier 3: Strip materials and sizes, keep only core identifiers
  const tier3Stripped = [...tier2Stripped];
  let tier3Query = stripWords(tier2Query || tier1Query, MATERIAL_WORDS, tier3Stripped);

  // Strip size patterns
  for (const pattern of SIZE_PATTERNS) {
    const matches = tier3Query.match(pattern);
    if (matches) {
      tier3Stripped.push(...matches);
      tier3Query = tier3Query.replace(pattern, ' ');
    }
  }

  // Clean up
  tier3Query = tier3Query
    .replace(/[,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Only add Tier 3 if meaningfully different
  const tier2QueryLower = (tier2Query || tier1Query).toLowerCase();
  if (
    tier3Query.length > 3 &&
    tier3Query.toLowerCase() !== tier2QueryLower
  ) {
    results.push({
      query: tier3Query,
      tier: 3,
      confidence: 0.70,
      strippedTerms: tier3Stripped,
    });
  }

  return results;
}

/**
 * Execute search with progressive fallback
 */
export async function searchWithFallback<T>(
  originalQuery: string,
  searchFunction: (query: string) => Promise<{ results: T[]; total: number }>,
  minResults: number = 3
): Promise<{
  results: T[];
  total: number;
  usedQuery: string;
  originalQuery: string;
  tier: 1 | 2 | 3;
  confidence: number;
  broadened: boolean;
  strippedTerms: string[];
}> {
  const queries = broadenQuery(originalQuery);

  for (const { query, tier, confidence, strippedTerms } of queries) {
    try {
      const { results, total } = await searchFunction(query);

      if (results.length >= minResults) {
        return {
          results,
          total,
          usedQuery: query,
          originalQuery,
          tier,
          confidence,
          broadened: tier > 1,
          strippedTerms,
        };
      }
    } catch (error) {
      console.error(`Search failed for tier ${tier} query:`, error);
      // Continue to next tier
    }
  }

  // If all tiers fail, return whatever we got from the last attempt
  const lastQuery = queries[queries.length - 1];
  try {
    const { results, total } = await searchFunction(lastQuery.query);
    return {
      results,
      total,
      usedQuery: lastQuery.query,
      originalQuery,
      tier: lastQuery.tier,
      confidence: lastQuery.confidence * 0.5, // Penalty for insufficient results
      broadened: true,
      strippedTerms: lastQuery.strippedTerms,
    };
  } catch {
    // Return empty results if everything fails
    return {
      results: [],
      total: 0,
      usedQuery: lastQuery.query,
      originalQuery,
      tier: lastQuery.tier,
      confidence: 0.1,
      broadened: true,
      strippedTerms: lastQuery.strippedTerms,
    };
  }
}

/**
 * Get a human-readable explanation of query broadening
 */
export function getBroadeningExplanation(
  originalQuery: string,
  usedQuery: string,
  tier: number,
  strippedTerms: string[]
): string | null {
  if (tier === 1) {
    return null; // No broadening needed
  }

  if (strippedTerms.length === 0) {
    return `Simplified search query for more results`;
  }

  const termsStr = strippedTerms.slice(0, 3).join(', ');
  const moreCount = strippedTerms.length - 3;

  if (tier === 2) {
    return `Broadened search by removing: ${termsStr}${moreCount > 0 ? ` +${moreCount} more` : ''}`;
  }

  return `Significantly broadened search (Tier 3) - results may be less precise`;
}
