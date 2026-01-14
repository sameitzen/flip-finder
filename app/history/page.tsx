'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanSession } from '@/lib/types';
import { Header } from '@/components/layout';
import { ScanHistoryList } from '@/components/history';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export default function HistoryPage() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = () => {
    try {
      const stored = localStorage.getItem('flip-finder-scans');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const scans = parsed.map((scan: ScanSession) => ({
          ...scan,
          marketData: {
            ...scan.marketData,
            soldListings: scan.marketData.soldListings.map(l => ({
              ...l,
              soldDate: new Date(l.soldDate),
            })),
          },
        }));
        setScans(scans);
      }
    } catch {
      console.error('Failed to load scans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanClick = (scan: ScanSession) => {
    // Store the scan in sessionStorage and navigate to results
    sessionStorage.setItem('currentScan', JSON.stringify({
      itemIdentity: scan.itemIdentity,
      marketData: scan.marketData,
      vestScore: scan.vestScore,
      imageBase64: scan.imageBase64,
      timestamp: scan.timestamp,
    }));
    router.push('/results');
  };

  const handleClearAll = () => {
    if (confirm('Clear all scan history?')) {
      localStorage.removeItem('flip-finder-scans');
      setScans([]);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {scans.length > 0 && (
          <div className="flex justify-end mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        )}

        <ScanHistoryList
          scans={scans}
          onScanClick={handleScanClick}
        />
      </main>
    </div>
  );
}
