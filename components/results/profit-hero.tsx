'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfitBreakdown } from '@/lib/utils/profit-calculator';
import { Grade, Recommendation } from '@/lib/types';
import { ChevronDown, ChevronUp, TrendingUp, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnimatedNumber } from '@/hooks/use-animated-number';

interface ProfitHeroProps {
  netProfit: number;
  roi: number;
  daysToSell: number;
  grade: Grade;
  recommendation: Recommendation;
  profitBreakdown: ProfitBreakdown;
  gradeOverrideExplanation?: string | null;
}

export function ProfitHero({
  netProfit,
  roi,
  daysToSell,
  grade,
  recommendation,
  profitBreakdown,
  gradeOverrideExplanation,
}: ProfitHeroProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Animated profit value (count-up effect)
  const animatedProfit = useAnimatedNumber(Math.abs(netProfit), { duration: 800, decimals: 2 });
  const animatedRoi = useAnimatedNumber(roi, { duration: 600, decimals: 0 });

  const isPositive = netProfit >= 0;
  const profitColor = isPositive ? 'text-emerald-400' : 'text-red-500';
  const profitGlow = isPositive
    ? 'drop-shadow-[0_0_24px_rgba(52,211,153,0.4)]'
    : 'drop-shadow-[0_0_24px_rgba(239,68,68,0.4)]';

  const velocityInfo = getVelocityInfo(daysToSell);
  const gradeInfo = getGradeInfo(grade);
  const recommendationInfo = getRecommendationInfo(recommendation);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-0">
        {/* Main profit display */}
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
            Net Profit
          </p>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="group"
          >
            <p className={cn('text-5xl font-bold font-mono tabular-nums', profitColor, profitGlow)}>
              {isPositive ? '+' : '-'}${animatedProfit.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              tap for breakdown
              {showBreakdown ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </p>
          </button>

          {/* ROI and Velocity inline */}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1.5">
              <TrendingUp className={cn('w-4 h-4', roi >= 50 ? 'text-emerald-400' : roi >= 20 ? 'text-yellow-500' : 'text-red-500')} />
              <span className={cn('font-medium font-mono tabular-nums', roi >= 50 ? 'text-emerald-400' : roi >= 20 ? 'text-yellow-500' : 'text-red-500')}>
                {animatedRoi.toFixed(0)}% ROI
              </span>
            </div>
            <span className="text-border">•</span>
            <div className="flex items-center gap-1.5">
              <Clock className={cn('w-4 h-4', velocityInfo.color)} />
              <span className={cn('font-medium', velocityInfo.color)}>
                ~{daysToSell} days
              </span>
            </div>
          </div>
        </div>

        {/* Fee breakdown (expandable) */}
        {showBreakdown && (
          <div className="border-t border-border bg-background/50 p-4">
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sale Price</span>
                <span>${profitBreakdown.expectedSalePrice.toFixed(2)}</span>
              </div>
              <div className="border-t border-border/50 my-2" />
              <div className="flex justify-between text-muted-foreground">
                <span>eBay Fee (12.9%)</span>
                <span className="text-red-400">-${profitBreakdown.ebayFinalValueFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Payment Fee</span>
                <span className="text-red-400">-${profitBreakdown.paymentProcessingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span className="text-red-400">-${profitBreakdown.shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Your Cost</span>
                <span className="text-red-400">-${profitBreakdown.buyPrice.toFixed(2)}</span>
              </div>
              <div className="border-t border-border my-2" />
              <div className="flex justify-between font-bold">
                <span>NET PROFIT</span>
                <span className={profitColor}>
                  {isPositive ? '+' : ''}${netProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Velocity gauge */}
        <div className="px-6 pb-4">
          <div className="bg-background/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                Velocity
              </span>
              <div className="flex items-center gap-1.5">
                <Zap className={cn('w-3.5 h-3.5', velocityInfo.color)} />
                <span className={cn('text-xs font-medium', velocityInfo.color)}>
                  {velocityInfo.label}
                </span>
              </div>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', velocityInfo.bgColor)}
                style={{ width: `${velocityInfo.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Grade badge and recommendation */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-center gap-4">
          <div
            className={cn(
              'w-16 h-16 rounded-xl flex flex-col items-center justify-center border-2',
              gradeInfo.borderColor,
              gradeInfo.bgColor
            )}
          >
            <span className={cn('text-2xl font-bold', gradeInfo.textColor)}>
              {grade}
            </span>
          </div>
          <div className="text-left">
            <Badge
              variant="outline"
              className={cn('text-xs font-semibold', recommendationInfo.color, recommendationInfo.borderColor)}
            >
              {recommendationInfo.label}
            </Badge>
            {gradeOverrideExplanation && (
              <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">
                {gradeOverrideExplanation}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getVelocityInfo(days: number): {
  label: string;
  color: string;
  bgColor: string;
  percent: number;
} {
  if (days <= 3) {
    return { label: 'Lightning Fast', color: 'text-emerald-400', bgColor: 'bg-emerald-400', percent: 100 };
  }
  if (days <= 7) {
    return { label: 'Very Fast', color: 'text-emerald-400', bgColor: 'bg-emerald-400', percent: 85 };
  }
  if (days <= 14) {
    return { label: 'Quick', color: 'text-yellow-400', bgColor: 'bg-yellow-400', percent: 65 };
  }
  if (days <= 21) {
    return { label: 'Moderate', color: 'text-yellow-500', bgColor: 'bg-yellow-500', percent: 45 };
  }
  if (days <= 30) {
    return { label: 'Slow', color: 'text-orange-500', bgColor: 'bg-orange-500', percent: 30 };
  }
  return { label: 'Very Slow', color: 'text-red-500', bgColor: 'bg-red-500', percent: 15 };
}

function getGradeInfo(grade: Grade): {
  textColor: string;
  borderColor: string;
  bgColor: string;
} {
  if (grade.startsWith('A')) {
    return {
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-400',
      bgColor: 'bg-emerald-400/10',
    };
  }
  if (grade.startsWith('B')) {
    return {
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-400/70',
      bgColor: 'bg-emerald-400/10',
    };
  }
  if (grade.startsWith('C')) {
    return {
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-400',
      bgColor: 'bg-yellow-400/10',
    };
  }
  if (grade.startsWith('D')) {
    return {
      textColor: 'text-orange-400',
      borderColor: 'border-orange-400',
      bgColor: 'bg-orange-400/10',
    };
  }
  return {
    textColor: 'text-red-500',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-500/10',
  };
}

function getRecommendationInfo(rec: Recommendation): {
  label: string;
  color: string;
  borderColor: string;
} {
  const info: Record<Recommendation, { label: string; color: string; borderColor: string }> = {
    'strong-buy': { label: 'STRONG BUY', color: 'text-emerald-400', borderColor: 'border-emerald-400' },
    'buy': { label: 'BUY', color: 'text-emerald-400', borderColor: 'border-emerald-400/70' },
    'hold': { label: 'HOLD', color: 'text-yellow-400', borderColor: 'border-yellow-400' },
    'pass': { label: 'PASS', color: 'text-orange-400', borderColor: 'border-orange-400' },
    'strong-pass': { label: 'STRONG PASS', color: 'text-red-500', borderColor: 'border-red-500' },
  };
  return info[rec];
}
