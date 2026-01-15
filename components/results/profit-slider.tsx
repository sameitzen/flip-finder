'use client';

import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';

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
}: ProfitSliderProps) {
  const maxPrice = Math.round(medianSoldPrice * 1.2);

  const handleSliderChange = (value: number[]) => {
    onBuyPriceChange(value[0]);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        {/* Header with label and value */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Buy Price</span>
          <span className="font-mono text-lg font-semibold tabular-nums">${buyPrice}</span>
        </div>

        {/* Slider */}
        <Slider
          value={[buyPrice]}
          onValueChange={handleSliderChange}
          min={0}
          max={maxPrice}
          step={1}
          className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
        />

        {/* Min/max labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground/40 mt-1.5 px-0.5">
          <span>$0</span>
          <span>${maxPrice}</span>
        </div>
      </CardContent>
    </Card>
  );
}
