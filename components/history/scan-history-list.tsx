'use client';

import { ScanSession } from '@/lib/types';
import { ScanHistoryCard } from './scan-history-card';
import { History } from 'lucide-react';

interface ScanHistoryListProps {
  scans: ScanSession[];
  onScanClick: (scan: ScanSession) => void;
}

export function ScanHistoryList({ scans, onScanClick }: ScanHistoryListProps) {
  if (scans.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <History className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">No scans yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your saved scans will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scans.map((scan) => (
        <ScanHistoryCard
          key={scan.id}
          scan={scan}
          onClick={() => onScanClick(scan)}
        />
      ))}
    </div>
  );
}
