export type ConditionEstimate = 'new' | 'like-new' | 'good' | 'fair' | 'poor';

export interface AIPriceEstimate {
  low: number;
  mid: number;
  high: number;
  msrp?: number;
  confidence: number;
  reasoning: string;
  demandLevel: 'high' | 'medium' | 'low';
  redFlags?: string[];
}

export interface ItemIdentity {
  name: string;
  brand: string;
  model: string;
  category: string;
  condition: ConditionEstimate;
  confidence: number;
  searchQuery: string;
  keywords: string[];
  era?: string;
  isPNWTreasure?: boolean;
  priceEstimate?: AIPriceEstimate;
}
