'use client';

import { useEffect, useState } from 'react';
import { Camera, Search, BarChart3, Calculator, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AnalysisStage =
  | 'capture'
  | 'identify'
  | 'search'
  | 'analyze'
  | 'calculate'
  | 'complete';

interface StageConfig {
  id: AnalysisStage;
  label: string;
  activeLabel: string;
  icon: React.ElementType;
  minDuration: number; // minimum ms to show this stage
}

const STAGES: StageConfig[] = [
  {
    id: 'capture',
    label: 'Captured',
    activeLabel: 'Capturing...',
    icon: Camera,
    minDuration: 300,
  },
  {
    id: 'identify',
    label: 'Identified',
    activeLabel: 'Identifying item...',
    icon: Search,
    minDuration: 1500,
  },
  {
    id: 'search',
    label: 'Searched',
    activeLabel: 'Searching eBay...',
    icon: BarChart3,
    minDuration: 1200,
  },
  {
    id: 'analyze',
    label: 'Analyzed',
    activeLabel: 'Analyzing market...',
    icon: BarChart3,
    minDuration: 800,
  },
  {
    id: 'calculate',
    label: 'Calculated',
    activeLabel: 'Calculating profit...',
    icon: Calculator,
    minDuration: 600,
  },
  {
    id: 'complete',
    label: 'Complete',
    activeLabel: 'Done!',
    icon: CheckCircle2,
    minDuration: 0,
  },
];

interface AnalysisProgressProps {
  currentStage: AnalysisStage;
  partialResult?: {
    itemName?: string;
    listingsFound?: number;
    priceRange?: string;
  };
  onCancel?: () => void;
}

export function AnalysisProgress({
  currentStage,
  partialResult,
  onCancel,
}: AnalysisProgressProps) {
  const [displayStage, setDisplayStage] = useState<AnalysisStage>('capture');
  const [stageStartTime, setStageStartTime] = useState(Date.now());

  // Ensure minimum display time per stage
  useEffect(() => {
    const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
    const displayIndex = STAGES.findIndex((s) => s.id === displayStage);

    if (currentIndex > displayIndex) {
      const currentStageConfig = STAGES[displayIndex];
      const elapsed = Date.now() - stageStartTime;
      const remaining = Math.max(0, currentStageConfig.minDuration - elapsed);

      if (remaining > 0) {
        const timer = setTimeout(() => {
          const nextStage = STAGES[displayIndex + 1];
          if (nextStage) {
            setDisplayStage(nextStage.id);
            setStageStartTime(Date.now());
          }
        }, remaining);
        return () => clearTimeout(timer);
      } else {
        const nextStage = STAGES[displayIndex + 1];
        if (nextStage) {
          setDisplayStage(nextStage.id);
          setStageStartTime(Date.now());
        }
      }
    }
  }, [currentStage, displayStage, stageStartTime]);

  const currentStageIndex = STAGES.findIndex((s) => s.id === displayStage);
  const currentConfig = STAGES[currentStageIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      {/* Main icon with animation */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        <div className="relative w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
          <currentConfig.icon className="w-10 h-10 text-primary animate-pulse" />
        </div>
      </div>

      {/* Current stage label */}
      <h2 className="text-xl font-semibold mb-2">{currentConfig.activeLabel}</h2>

      {/* Partial results */}
      {partialResult?.itemName && displayStage !== 'capture' && (
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
          {partialResult.itemName}
        </p>
      )}

      {partialResult?.listingsFound !== undefined &&
        (displayStage === 'search' || displayStage === 'analyze' || displayStage === 'calculate') && (
          <p className="text-sm text-muted-foreground mb-6">
            Found {partialResult.listingsFound} comparable listings
          </p>
        )}

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {STAGES.slice(0, -1).map((stage, index) => {
          const isComplete = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;

          return (
            <div key={stage.id} className="flex items-center">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-300',
                  isComplete
                    ? 'bg-primary'
                    : isCurrent
                    ? 'bg-primary animate-pulse'
                    : 'bg-muted'
                )}
              />
              {index < STAGES.length - 2 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1 transition-all duration-300',
                    isComplete ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage labels (small) */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        {STAGES.slice(0, -1).map((stage, index) => {
          const isComplete = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const Icon = stage.icon;

          return (
            <div
              key={stage.id}
              className={cn(
                'flex flex-col items-center gap-1 transition-all',
                isComplete ? 'text-primary' : isCurrent ? 'text-foreground' : ''
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      )}

      {/* Taking too long message */}
      {displayStage === 'identify' && (
        <TakingLongMessage threshold={5000} stageStartTime={stageStartTime} />
      )}
    </div>
  );
}

function TakingLongMessage({
  threshold,
  stageStartTime,
}: {
  threshold: number;
  stageStartTime: number;
}) {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMessage(true);
    }, threshold);
    return () => clearTimeout(timer);
  }, [threshold, stageStartTime]);

  if (!showMessage) return null;

  return (
    <p className="mt-6 text-xs text-muted-foreground animate-fade-in">
      Taking longer than usual... hang tight!
    </p>
  );
}

/**
 * Hook to manage analysis progress state
 */
export function useAnalysisProgress() {
  const [stage, setStage] = useState<AnalysisStage>('capture');
  const [partialResult, setPartialResult] = useState<{
    itemName?: string;
    listingsFound?: number;
    priceRange?: string;
  }>({});

  const updateStage = (newStage: AnalysisStage, partial?: typeof partialResult) => {
    setStage(newStage);
    if (partial) {
      setPartialResult((prev) => ({ ...prev, ...partial }));
    }
  };

  const reset = () => {
    setStage('capture');
    setPartialResult({});
  };

  return {
    stage,
    partialResult,
    updateStage,
    reset,
  };
}
