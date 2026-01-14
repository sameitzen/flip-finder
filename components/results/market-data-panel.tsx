'use client';

import { MarketSummary } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Clock, Package, Activity } from 'lucide-react';

interface MarketDataPanelProps {
  summary: MarketSummary;
}

export function MarketDataPanel({ summary }: MarketDataPanelProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Market Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <StatItem
            icon={<TrendingUp className="w-4 h-4" />}
            label="Avg Sold"
            value={`$${summary.avgSoldPrice.toFixed(0)}`}
          />
          <StatItem
            icon={<Package className="w-4 h-4" />}
            label="30-Day Sales"
            value={summary.totalSold30Days.toLocaleString()}
          />
          <StatItem
            icon={<Clock className="w-4 h-4" />}
            label="Avg Sell Time"
            value={`~${summary.avgDaysToSell.toFixed(0)} days`}
          />
          <StatItem
            icon={<Activity className="w-4 h-4" />}
            label="Active Listings"
            value={summary.activeListingCount.toLocaleString()}
          />
        </div>

        {/* Price range */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Price Range</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">${summary.minSoldPrice.toFixed(0)}</span>
            <div className="flex-1 mx-3 h-1 bg-muted rounded-full relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full"
                style={{
                  left: `${((summary.medianSoldPrice - summary.minSoldPrice) / (summary.maxSoldPrice - summary.minSoldPrice)) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm font-mono">${summary.maxSoldPrice.toFixed(0)}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Median: ${summary.medianSoldPrice.toFixed(0)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold font-mono">{value}</p>
      </div>
    </div>
  );
}
