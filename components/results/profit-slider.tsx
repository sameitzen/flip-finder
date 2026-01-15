'use client';

import { Slider } from '@/components/ui/slider';
import { DollarSign } from 'lucide-react';

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
    <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border safe-bottom">
      <div className="px-4 py-3">
        {/* Label and value row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Your buy price</span>
          </div>
          <span className="font-mono text-2xl font-bold tabular-nums">${buyPrice.toFixed(0)}</span>
        </div>

        {/* Slider - extra touch friendly */}
        <div className="px-1">
          <Slider
            value={[buyPrice]}
            onValueChange={handleSliderChange}
            min={0}
            max={maxPrice}
            step={1}
            className="touch-target [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>$0</span>
            <span className="text-muted-foreground/60">median ${medianSoldPrice.toFixed(0)}</span>
            <span>${maxPrice}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
