'use client';

import { useMemo } from 'react';
import { MarketData, VestScore } from '@/lib/types';
import { calculateVestScore } from '@/lib/vest';

interface UseVestCalculationOptions {
  estimatedFees?: number;
  shippingCost?: number;
}

export function useVestCalculation(
  marketData: MarketData,
  buyPrice: number,
  options: UseVestCalculationOptions = {}
): VestScore {
  const { estimatedFees = 0.13, shippingCost = 5 } = options;

  return useMemo(() => {
    return calculateVestScore(marketData, {
      buyPrice,
      estimatedFees,
      shippingCost,
    });
  }, [marketData, buyPrice, estimatedFees, shippingCost]);
}
