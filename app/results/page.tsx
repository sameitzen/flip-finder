'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ItemIdentity, MarketData, VestScore } from '@/lib/types';
import { useVestCalculation } from '@/hooks/use-vest-calculation';
import { identifyFromText, scanItem } from '@/lib/actions/scan-item';
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
  const [isRefining, setIsRefining] = useState(false);
  const [excludedListings, setExcludedListings] = useState<Set<number>>(new Set());

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

  const handleAddImages = async (newImages: string[]) => {
    if (!scanData) return;

    setIsRefining(true);

    // Combine existing images with new ones
    const existingImages = scanData.images || [scanData.imageBase64];
    const allImages = [...existingImages, ...newImages];

    // Re-analyze with all images
    const result = await scanItem(allImages);

    if (result.success) {
      const newScanData: StoredScan = {
        ...scanData,
        itemIdentity: result.data.itemIdentity,
        marketData: result.data.marketData,
        vestScore: result.data.vestScore,
        images: allImages,
        imageBase64: allImages[0], // Keep first image as primary
      };

      sessionStorage.setItem('currentScan', JSON.stringify(newScanData));
      setScanData(newScanData);
      setBuyPrice(Math.round(result.data.marketData.summary.medianSoldPrice * 0.4));
      setIsSaved(false);

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } else {
      console.error('Refinement failed:', result.error);
      alert(result.error.message);
    }

    setIsRefining(false);
  };

  // Handle excluding a listing from comps
  const handleExcludeListing = useCallback((index: number, _reason: string) => {
    setExcludedListings(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

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
          onAddImages={handleAddImages}
          isCorreecting={isCorreecting}
          isRefining={isRefining}
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
            usedQuery={scanData.marketData.searchMeta?.usedQuery}
            queryBroadened={scanData.marketData.searchMeta?.queryBroadened}
            broadeningExplanation={scanData.marketData.searchMeta?.broadeningExplanation}
            onExclude={handleExcludeListing}
            excludedIndices={excludedListings}
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
