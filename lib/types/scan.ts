import { ItemIdentity } from './item';
import { MarketData } from './market';
import { VestScore } from './vest';

export interface ScanSession {
  id: string;
  timestamp: number;
  imageBase64: string;
  itemIdentity: ItemIdentity;
  marketData: MarketData;
  vestScore: VestScore;
  buyPrice: number;
}

export interface ScanResult {
  itemIdentity: ItemIdentity;
  marketData: MarketData;
  vestScore: VestScore;
}
