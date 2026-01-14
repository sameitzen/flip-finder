export interface SoldListing {
  title: string;
  soldPrice: number;
  soldDate: Date;
  condition: string;
  shippingCost: number;
  imageUrl?: string;
}

export interface ActiveListing {
  title: string;
  currentPrice: number;
  listingType: 'auction' | 'buy-it-now';
  bids?: number;
  watchers: number;
  condition: string;
  imageUrl?: string;
}

export interface MarketSummary {
  avgSoldPrice: number;
  medianSoldPrice: number;
  minSoldPrice: number;
  maxSoldPrice: number;
  totalSold30Days: number;
  totalSold90Days: number;
  avgDaysToSell: number;
  activeListingCount: number;
  avgActivePrice: number;
  sellThroughRate: number;
  priceVolatility: number;
}

export interface MarketData {
  soldListings: SoldListing[];
  activeListings: ActiveListing[];
  summary: MarketSummary;
}
