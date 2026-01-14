export type ConditionEstimate = 'new' | 'like-new' | 'good' | 'fair' | 'poor';

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
}
