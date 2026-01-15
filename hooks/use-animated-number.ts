'use client';

import { useEffect, useState, useRef } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number; // ms
  delay?: number; // ms
  decimals?: number;
}

/**
 * Animates a number from 0 (or previous value) to the target value
 * with a count-up effect
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 800, delay = 0, decimals = 2 } = options;
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startValue = prevValueRef.current;
    const startTime = performance.now() + delay;

    const animate = (currentTime: number) => {
      if (currentTime < startTime) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (targetValue - startValue) * easeOut;

      // Round to specified decimals
      const factor = Math.pow(10, decimals);
      setDisplayValue(Math.round(currentValue * factor) / factor);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = targetValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, delay, decimals]);

  return displayValue;
}

/**
 * Formats a number as currency with animated value
 */
export function useAnimatedCurrency(
  value: number,
  options: UseAnimatedNumberOptions = {}
): string {
  const animatedValue = useAnimatedNumber(value, { ...options, decimals: 2 });
  const isPositive = value >= 0;
  const sign = isPositive ? '+' : '';
  return `${sign}$${Math.abs(animatedValue).toFixed(2)}`;
}

/**
 * Formats a number as percentage with animated value
 */
export function useAnimatedPercent(
  value: number,
  options: UseAnimatedNumberOptions = {}
): string {
  const animatedValue = useAnimatedNumber(value, { ...options, decimals: 0 });
  const sign = value >= 0 ? '+' : '';
  return `${sign}${animatedValue.toFixed(0)}%`;
}
