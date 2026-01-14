'use client';

import { cn } from '@/lib/utils';

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
    <div className="flex justify-center">
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={cn(
          'relative w-16 h-16 rounded-full',
          'bg-white/10 border-[3px] border-white',
          'flex items-center justify-center',
          'transition-all duration-200',
          'touch-target',
          'active:scale-95',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-4 focus:ring-primary/50'
        )}
        aria-label={isProcessing ? 'Processing...' : 'Capture photo'}
      >
        {/* Inner circle */}
        <div
          className={cn(
            'w-11 h-11 rounded-full',
            'transition-all duration-200',
            isProcessing
              ? 'bg-primary/50 animate-pulse'
              : 'bg-white hover:bg-white/90 active:bg-primary'
          )}
        />

        {/* Processing ring */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full border-4 border-transparent border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </button>
    </div>
  );
}
