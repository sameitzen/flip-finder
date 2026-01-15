'use client';

import { cn } from '@/lib/utils';
import { Camera, Sparkles } from 'lucide-react';

interface CaptureButtonProps {
  onCapture: () => void;
  onAnalyze: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  hasPhotos?: boolean;
  photoCount?: number;
  maxPhotos?: number;
}

export function CaptureButton({
  onCapture,
  onAnalyze,
  disabled = false,
  isProcessing = false,
  hasPhotos = false,
  photoCount = 0,
  maxPhotos = 4,
}: CaptureButtonProps) {
  const canAddMore = photoCount < maxPhotos;

  const handleClick = () => {
    if (disabled || isProcessing) return;

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(hasPhotos ? 100 : 50);
    }

    if (hasPhotos) {
      onAnalyze();
    } else {
      onCapture();
    }
  };

  const handleAddMore = () => {
    if (disabled || isProcessing || !canAddMore) return;

    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    onCapture();
  };

  // Processing state
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          disabled
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          aria-label="Analyzing..."
        >
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/30" />
          {/* Spinning ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          {/* Inner content */}
          <div className="relative z-10 w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Camera className="w-6 h-6 text-primary animate-pulse" />
          </div>
        </button>
        <p className="text-xs font-medium text-primary">Analyzing...</p>
      </div>
    );
  }

  // Has photos - show Analyze button with option to add more
  if (hasPhotos) {
    return (
      <div className="flex items-center justify-center gap-4">
        {/* Add more button (secondary) */}
        {canAddMore && (
          <button
            onClick={handleAddMore}
            disabled={disabled}
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center',
              'border-2 border-white/30 bg-white/10',
              'transition-all duration-200',
              'active:scale-95',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Add another photo"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Analyze button (primary) */}
        <button
          onClick={handleClick}
          disabled={disabled}
          className={cn(
            'relative w-20 h-20 rounded-full',
            'flex items-center justify-center',
            'transition-all duration-300',
            'active:scale-95',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Analyze photos"
        >
          {/* Outer ring - green/primary */}
          <div className="absolute inset-0 rounded-full border-[3px] border-primary shadow-[0_0_20px_rgba(74,222,128,0.3)]" />
          {/* Inner button */}
          <div className="relative z-10 w-14 h-14 rounded-full bg-primary flex items-center justify-center active:scale-95">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
        </button>

        {/* Spacer for symmetry when add more is shown */}
        {canAddMore && <div className="w-14" />}
      </div>
    );
  }

  // Default capture state - no photos yet
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'relative w-20 h-20 rounded-full',
          'flex items-center justify-center',
          'transition-all duration-300',
          'touch-target',
          'focus:outline-none',
          disabled && 'opacity-50 cursor-not-allowed',
          'active:scale-95'
        )}
        aria-label="Capture photo"
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
        {/* Inner content */}
        <div className="relative z-10 w-14 h-14 rounded-full bg-white hover:bg-white/90 active:bg-primary active:scale-95 transition-all duration-200" />
      </button>
      <p className="text-xs font-medium text-white/70">Tap to scan</p>
    </div>
  );
}
