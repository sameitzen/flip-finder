'use client';

import { AIPriceEstimate } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, DollarSign } from 'lucide-react';

interface AIInsightsPanelProps {
  priceEstimate: AIPriceEstimate;
}

export function AIInsightsPanel({ priceEstimate }: AIInsightsPanelProps) {
  const { low, mid, high, confidence, reasoning, demandLevel, redFlags } = priceEstimate;

  const demandConfig = {
    high: { label: 'High Demand', icon: TrendingUp, color: 'text-green-500' },
    medium: { label: 'Medium Demand', icon: Minus, color: 'text-yellow-500' },
    low: { label: 'Low Demand', icon: TrendingDown, color: 'text-red-500' },
  };

  const demand = demandConfig[demandLevel];
  const DemandIcon = demand.icon;

  const confidencePercent = Math.round(confidence * 100);
  const confidenceLabel = confidencePercent >= 80 ? 'High' : confidencePercent >= 50 ? 'Medium' : 'Low';

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          AI Analysis
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {confidenceLabel} confidence ({confidencePercent}%)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Price Range */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">AI Price Estimate</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground">${low}</span>
              <span className="text-lg font-bold font-mono text-primary">${mid}</span>
              <span className="text-xs text-muted-foreground">${high}</span>
            </div>
          </div>
        </div>

        {/* Demand Level */}
        <div className="flex items-center gap-4">
          <div className={demand.color}>
            <DemandIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Market Demand</p>
            <p className={`text-sm font-semibold ${demand.color}`}>{demand.label}</p>
          </div>
        </div>

        {/* Reasoning */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Why this price?</p>
          <p className="text-sm text-foreground/90 leading-relaxed">{reasoning}</p>
        </div>

        {/* Red Flags */}
        {redFlags && redFlags.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-medium text-amber-500">Things to Watch</p>
            </div>
            <ul className="space-y-1">
              {redFlags.map((flag, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-500/70">•</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
