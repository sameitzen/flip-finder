'use client';

import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProfitSliderProps {
  buyPrice: number;
  onBuyPriceChange: (price: number) => void;
  medianSoldPrice: number;
  estimatedProfit: number;
  roi: number;
}

export function ProfitSlider({
  buyPrice,
  onBuyPriceChange,
  medianSoldPrice,
  estimatedProfit,
  roi,
}: ProfitSliderProps) {
  const maxPrice = Math.round(medianSoldPrice * 1.2);
  const isPositiveProfit = estimatedProfit >= 0;

  const handleSliderChange = (value: number[]) => {
    onBuyPriceChange(value[0]);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Buy Price</span>
          <span className="font-mono text-xl">${buyPrice.toFixed(0)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slider */}
        <div className="px-1">
          <Slider
            value={[buyPrice]}
            onValueChange={handleSliderChange}
            min={0}
            max={maxPrice}
            step={1}
            className="touch-target"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>$0</span>
            <span>${maxPrice}</span>
          </div>
        </div>

        {/* Profit display */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Est. Profit</p>
            <p className={cn(
              'text-2xl font-bold font-mono',
              isPositiveProfit ? 'text-vest-buy' : 'text-vest-pass'
            )}>
              {isPositiveProfit ? '+' : '-'}${Math.abs(estimatedProfit).toFixed(0)}
            </p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-xs text-muted-foreground">ROI</p>
            <p className={cn(
              'text-xl font-bold font-mono',
              isPositiveProfit ? 'text-vest-buy' : 'text-vest-pass'
            )}>
              {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
