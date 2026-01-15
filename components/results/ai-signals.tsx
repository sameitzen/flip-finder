'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISignalsProps {
  reasoning?: string;
  demandLevel?: 'high' | 'medium' | 'low';
  redFlags?: string[];
  confidence?: number;
}

export function AISignals({
  reasoning,
  demandLevel,
  redFlags,
  confidence,
}: AISignalsProps) {
  // Only show if we have meaningful insights
  const hasRedFlags = redFlags && redFlags.length > 0;
  const hasDemand = demandLevel && demandLevel !== 'medium';

  if (!hasRedFlags && !hasDemand) {
    return null;
  }

  const demandIcon = demandLevel === 'high' ? TrendingUp : demandLevel === 'low' ? TrendingDown : Minus;
  const DemandIcon = demandIcon;
  const demandColor = demandLevel === 'high' ? 'text-emerald-500' : demandLevel === 'low' ? 'text-red-500' : 'text-muted-foreground';
  const demandText = demandLevel === 'high' ? 'High demand' : demandLevel === 'low' ? 'Low demand' : 'Average demand';

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        {/* Demand indicator */}
        {hasDemand && (
          <div className="flex items-center gap-2">
            <DemandIcon className={cn('w-4 h-4', demandColor)} />
            <span className={cn('text-sm font-medium', demandColor)}>
              {demandText}
            </span>
          </div>
        )}

        {/* Red flags - simple list */}
        {hasRedFlags && (
          <div className="space-y-2">
            {redFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{flag}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
