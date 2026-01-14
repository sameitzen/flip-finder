export type Grade =
  | 'A+' | 'A' | 'A-'
  | 'B+' | 'B' | 'B-'
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'F+' | 'F' | 'F-';

export type Recommendation = 'strong-buy' | 'buy' | 'hold' | 'pass' | 'strong-pass';

export interface ComponentScore {
  raw: number;
  normalized: number;
  weighted: number;
  weight: number;
  description: string;
}

export interface VestComponents {
  velocity: ComponentScore;
  equity: ComponentScore;
  stability: ComponentScore;
  trend: ComponentScore;
}

export interface VestScore {
  total: number;
  grade: Grade;
  components: VestComponents;
  recommendation: Recommendation;
  estimatedProfit: number;
  roi: number;
}

export interface VestInput {
  buyPrice: number;
  estimatedFees?: number;
  shippingCost?: number;
}
