'use client';

import { Slider } from '@/components/ui/slider';

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
    <div className="fixed bottom-16 inset-x-0 z-40">
      {/* Gradient fade from content to slider */}
      <div className="h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      {/* Slider container - solid background, anchored */}
      <div className="bg-background border-t border-border/50 px-5 pb-3 pt-3 safe-bottom">
        {/* Compact header */}
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

        {/* Min/max labels only */}
        <div className="flex justify-between text-[10px] text-muted-foreground/40 mt-1.5 px-0.5">
          <span>$0</span>
          <span>${maxPrice}</span>
        </div>
      </div>
    </div>
  );
}
