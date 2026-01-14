'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ItemIdentity, MarketData, VestScore } from '@/lib/types';
import { useVestCalculation } from '@/hooks/use-vest-calculation';
import { Header } from '@/components/layout';
import {
  ItemIdentification,
  VestScoreDisplay,
  ProfitSlider,
  MarketDataPanel,
  AIInsightsPanel,
} from '@/components/results';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw } from 'lucide-react';

interface StoredScan {
  itemIdentity: ItemIdentity;
  marketData: MarketData;
  vestScore: VestScore;
  imageBase64: string;
  timestamp: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const [scanData, setScanData] = useState<StoredScan | null>(null);
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [isSaved, setIsSaved] = useState(false);

  // Load scan data from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('currentScan');
    if (!stored) {
      router.push('/');
      return;
    }

    try {
      const data: StoredScan = JSON.parse(stored);

      // Convert date strings back to Date objects in market data
      data.marketData.soldListings = data.marketData.soldListings.map(l => ({
        ...l,
        soldDate: new Date(l.soldDate),
      }));

      setScanData(data);
      setBuyPrice(Math.round(data.marketData.summary.medianSoldPrice * 0.4));
    } catch {
      router.push('/');
    }
  }, [router]);

  // Calculate V.E.S.T. score in real-time based on buy price
  const vestScore = useVestCalculation(
    scanData?.marketData ?? {
      soldListings: [],
      activeListings: [],
      summary: {
        avgSoldPrice: 0,
        medianSoldPrice: 0,
        minSoldPrice: 0,
        maxSoldPrice: 0,
        totalSold30Days: 0,
        totalSold90Days: 0,
        avgDaysToSell: 0,
        activeListingCount: 0,
        avgActivePrice: 0,
        sellThroughRate: 0,
        priceVolatility: 0,
      },
    },
    buyPrice
  );

  const handleSave = () => {
    if (!scanData) return;

    // Get existing scans from localStorage
    const existingScans = JSON.parse(localStorage.getItem('flip-finder-scans') || '[]');

    // Create new scan entry
    const newScan = {
      id: `scan-${Date.now()}`,
      timestamp: scanData.timestamp,
      imageBase64: scanData.imageBase64,
      itemIdentity: scanData.itemIdentity,
      marketData: scanData.marketData,
      vestScore: vestScore,
      buyPrice: buyPrice,
    };

    // Add to beginning, limit to 20
    const updatedScans = [newScan, ...existingScans].slice(0, 20);
    localStorage.setItem('flip-finder-scans', JSON.stringify(updatedScans));

    setIsSaved(true);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }
  };

  const handleNewScan = () => {
    sessionStorage.removeItem('currentScan');
    router.push('/');
  };

  if (!scanData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Item identification */}
        <ItemIdentification
          item={scanData.itemIdentity}
          imageBase64={scanData.imageBase64}
        />

        {/* V.E.S.T. score display */}
        <VestScoreDisplay vestScore={vestScore} />

        {/* Profit slider */}
        <ProfitSlider
          buyPrice={buyPrice}
          onBuyPriceChange={setBuyPrice}
          medianSoldPrice={scanData.marketData.summary.medianSoldPrice}
          estimatedProfit={vestScore.estimatedProfit}
          roi={vestScore.roi}
        />

        {/* Market data */}
        <MarketDataPanel summary={scanData.marketData.summary} />

        {/* AI Insights - only show if we have price estimate data */}
        {scanData.itemIdentity.priceEstimate && (
          <AIInsightsPanel priceEstimate={scanData.itemIdentity.priceEstimate} />
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaved}
            className="flex-1"
            size="lg"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaved ? 'Saved!' : 'Save to History'}
          </Button>
          <Button
            onClick={handleNewScan}
            variant="outline"
            size="lg"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
