'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ItemIdentity, MarketData, VestScore } from '@/lib/types';
import { useVestCalculation } from '@/hooks/use-vest-calculation';
import { identifyFromText } from '@/lib/actions/scan-item';
import { Header } from '@/components/layout';
import {
  ItemIdentification,
  ProfitSlider,
  MarketDataPanel,
  ProfitHero,
  CompsGallery,
  AISignals,
} from '@/components/results';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw } from 'lucide-react';
import { SearchMetadata } from '@/lib/api/ebay';

interface ExtendedMarketData extends MarketData {
  searchMeta?: SearchMetadata;
}

interface StoredScan {
  itemIdentity: ItemIdentity;
  marketData: ExtendedMarketData;
  vestScore: VestScore;
  imageBase64: string;
  images?: string[]; // Support multiple images
  timestamp: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const [scanData, setScanData] = useState<StoredScan | null>(null);
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isCorreecting, setIsCorreecting] = useState(false);

  // Load scan data from sessionStorage (or window fallback for iOS private browsing)
  useEffect(() => {
    let stored = sessionStorage.getItem('currentScan');

    // Check window fallback if sessionStorage is empty (iOS private browsing)
    if (!stored) {
      const windowData = (window as Window & { __flipFinderScan?: StoredScan }).__flipFinderScan;
      if (windowData) {
        stored = JSON.stringify(windowData);
        // Clean up the window reference
        delete (window as Window & { __flipFinderScan?: StoredScan }).__flipFinderScan;
      }
    }

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

    try {
      // Get existing scans from localStorage
      const existingScans = JSON.parse(localStorage.getItem('flip-finder-scans') || '[]');

      // Create new scan entry - store thumbnail instead of full image to save space
      const newScan = {
        id: `scan-${Date.now()}`,
        timestamp: scanData.timestamp,
        imageBase64: scanData.imageBase64, // TODO: could compress to thumbnail
        itemIdentity: scanData.itemIdentity,
        marketData: scanData.marketData,
        vestScore: vestScore,
        buyPrice: buyPrice,
      };

      // Add to beginning, limit to 20
      const updatedScans = [newScan, ...existingScans].slice(0, 20);

      try {
        localStorage.setItem('flip-finder-scans', JSON.stringify(updatedScans));
      } catch (quotaError) {
        // Storage quota exceeded - remove oldest scans and try again
        console.warn('Storage quota exceeded, removing old scans...');
        const reducedScans = updatedScans.slice(0, 10);
        localStorage.setItem('flip-finder-scans', JSON.stringify(reducedScans));
      }

      setIsSaved(true);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 50, 50]);
      }
    } catch (error) {
      console.error('Failed to save scan:', error);
      // Still show as saved to not confuse user, but log the error
      setIsSaved(true);
    }
  };

  const handleNewScan = () => {
    sessionStorage.removeItem('currentScan');
    router.push('/');
  };

  const handleCorrection = async (description: string) => {
    if (!scanData) return;

    setIsCorreecting(true);

    const result = await identifyFromText(description);

    if (result.success) {
      // Update the scan data with new identification
      const newScanData: StoredScan = {
        ...scanData,
        itemIdentity: result.data.itemIdentity,
        marketData: result.data.marketData,
        vestScore: result.data.vestScore,
      };

      // Update session storage
      sessionStorage.setItem('currentScan', JSON.stringify(newScanData));

      // Update state
      setScanData(newScanData);
      setBuyPrice(Math.round(result.data.marketData.summary.medianSoldPrice * 0.4));
      setIsSaved(false); // Reset saved state since data changed

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } else {
      // Show error (could use a toast here)
      console.error('Correction failed:', result.error);
      alert(result.error.message);
    }

    setIsCorreecting(false);
  };

  if (!scanData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Get extended vest score with profit breakdown
  const extendedVestScore = vestScore as typeof vestScore & {
    profitBreakdown?: {
      expectedSalePrice: number;
      ebayFinalValueFee: number;
      paymentProcessingFee: number;
      shippingCost: number;
      promotedListingFee: number;
      totalPlatformCosts: number;
      buyPrice: number;
      netProfit: number;
      roi: number;
      effectiveMargin: number;
    };
    overrideExplanation?: string | null;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
        {/* Item identification */}
        <ItemIdentification
          item={scanData.itemIdentity}
          images={scanData.images || [scanData.imageBase64]}
          onCorrect={handleCorrection}
          isCorreecting={isCorreecting}
        />

        {/* Profit Hero - Net profit as the main focus */}
        <ProfitHero
          netProfit={vestScore.estimatedProfit}
          roi={vestScore.roi}
          daysToSell={scanData.marketData.summary.avgDaysToSell}
          grade={vestScore.grade}
          recommendation={vestScore.recommendation}
          profitBreakdown={extendedVestScore.profitBreakdown || {
            expectedSalePrice: scanData.marketData.summary.medianSoldPrice,
            ebayFinalValueFee: scanData.marketData.summary.medianSoldPrice * 0.129,
            paymentProcessingFee: (scanData.marketData.summary.medianSoldPrice * 0.029) + 0.30,
            shippingCost: 8,
            promotedListingFee: 0,
            totalPlatformCosts: 0,
            buyPrice: buyPrice,
            netProfit: vestScore.estimatedProfit,
            roi: vestScore.roi,
            effectiveMargin: 0,
          }}
          gradeOverrideExplanation={extendedVestScore.overrideExplanation}
        />

        {/* Buy Price Slider - inline below profit hero */}
        <ProfitSlider
          buyPrice={buyPrice}
          onBuyPriceChange={setBuyPrice}
          medianSoldPrice={scanData.marketData.summary.medianSoldPrice}
          estimatedProfit={vestScore.estimatedProfit}
          roi={vestScore.roi}
        />

        {/* Comps Gallery - Show actual eBay listings */}
        {scanData.marketData.activeListings.length > 0 && (
          <CompsGallery
            listings={scanData.marketData.activeListings}
            originalQuery={scanData.itemIdentity.searchQuery}
          />
        )}

        {/* AI Signals - Structured bullet points */}
        {scanData.itemIdentity.priceEstimate && (
          <AISignals
            reasoning={scanData.itemIdentity.priceEstimate.reasoning}
            demandLevel={scanData.itemIdentity.priceEstimate.demandLevel}
            redFlags={scanData.itemIdentity.priceEstimate.redFlags}
            confidence={scanData.itemIdentity.priceEstimate.confidence}
          />
        )}

        {/* Market data - only shows real eBay data + MSRP */}
        <MarketDataPanel
          summary={scanData.marketData.summary}
          aiEstimate={scanData.itemIdentity.priceEstimate}
        />

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
