'use client';

import { cn } from '@/lib/utils';
import { Camera, Check } from 'lucide-react';

interface CaptureButtonProps {
  onCapture: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

export function CaptureButton({ onCapture, disabled = false, isProcessing = false }: CaptureButtonProps) {
  const handleClick = () => {
    if (disabled || isProcessing) return;

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }

    onCapture();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={cn(
          'relative w-20 h-20 rounded-full',
          'flex items-center justify-center',
          'transition-all duration-300',
          'touch-target',
          'focus:outline-none',
          disabled && !isProcessing && 'opacity-50 cursor-not-allowed',
          // Default state: white ring with inner circle
          !isProcessing && 'active:scale-95'
        )}
        aria-label={isProcessing ? 'Analyzing...' : 'Capture photo'}
      >
        {/* Outer ring - always visible */}
        <div
          className={cn(
            'absolute inset-0 rounded-full transition-all duration-300',
            isProcessing
              ? 'border-4 border-primary/30'
              : 'border-[3px] border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
          )}
        />

        {/* Spinning ring when processing */}
        {isProcessing && (
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        )}

        {/* Inner content */}
        <div
          className={cn(
            'relative z-10 rounded-full transition-all duration-300 flex items-center justify-center',
            isProcessing
              ? 'w-14 h-14 bg-primary/20'
              : 'w-14 h-14 bg-white hover:bg-white/90 active:bg-primary active:scale-95'
          )}
        >
          {isProcessing ? (
            <Camera className="w-6 h-6 text-primary animate-pulse" />
          ) : null}
        </div>
      </button>

      {/* Status text */}
      <p className={cn(
        'text-xs font-medium transition-all duration-300',
        isProcessing ? 'text-primary' : 'text-white/70'
      )}>
        {isProcessing ? 'Analyzing...' : 'Tap to scan'}
      </p>
    </div>
  );
}
