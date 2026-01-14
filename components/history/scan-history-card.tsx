'use client';

import { ScanSession } from '@/lib/types';
import { gradeToColor, gradeToBgColor } from '@/lib/vest';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from '@/lib/utils/date';

interface ScanHistoryCardProps {
  scan: ScanSession;
  onClick: () => void;
}

export function ScanHistoryCard({ scan, onClick }: ScanHistoryCardProps) {
  const { itemIdentity, vestScore, buyPrice, timestamp, imageBase64 } = scan;
  const isPositiveProfit = vestScore.estimatedProfit >= 0;

  return (
    <Card
      className="border-border/50 bg-card/50 cursor-pointer hover:bg-card/80 transition-colors active:scale-[0.99]"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Thumbnail */}
          {imageBase64 && (
            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              <img
                src={imageBase64}
                alt={itemIdentity.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-sm line-clamp-1">
                  {itemIdentity.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(timestamp)}
                </p>
              </div>

              {/* Grade badge */}
              <div
                className={cn(
                  'px-2 py-0.5 rounded-md text-sm font-bold font-mono flex-shrink-0',
                  gradeToBgColor(vestScore.grade),
                  gradeToColor(vestScore.grade)
                )}
              >
                {vestScore.grade}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className="text-muted-foreground">
                Buy: <span className="font-mono">${buyPrice}</span>
              </span>
              <span className={cn(
                'font-mono font-medium',
                isPositiveProfit ? 'text-vest-buy' : 'text-vest-pass'
              )}>
                {isPositiveProfit ? '+' : '-'}${Math.abs(vestScore.estimatedProfit).toFixed(0)} profit
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
