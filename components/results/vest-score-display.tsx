'use client';

import { VestScore } from '@/lib/types';
import { recommendationToLabel, recommendationToColor } from '@/lib/vest';
import { GradeBadge } from './grade-badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface VestScoreDisplayProps {
  vestScore: VestScore;
}

export function VestScoreDisplay({ vestScore }: VestScoreDisplayProps) {
  const { grade, total, recommendation, components } = vestScore;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4">
          {/* Main grade badge */}
          <GradeBadge grade={grade} score={total} />

          {/* Recommendation signal */}
          <div className={cn('text-lg font-semibold tracking-wide', recommendationToColor(recommendation))}>
            {recommendationToLabel(recommendation)}
          </div>

          {/* V.E.S.T. breakdown bars */}
          <div className="w-full grid grid-cols-2 gap-3 mt-2">
            <ComponentBar
              label="V"
              fullLabel="Velocity"
              score={components.velocity.normalized}
              color="bg-vest-velocity"
            />
            <ComponentBar
              label="E"
              fullLabel="Equity"
              score={components.equity.normalized}
              color="bg-vest-equity"
            />
            <ComponentBar
              label="S"
              fullLabel="Stability"
              score={components.stability.normalized}
              color="bg-vest-stability"
            />
            <ComponentBar
              label="T"
              fullLabel="Trend"
              score={components.trend.normalized}
              color="bg-vest-trend"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ComponentBarProps {
  label: string;
  fullLabel: string;
  score: number;
  color: string;
}

function ComponentBar({ label, fullLabel, score, color }: ComponentBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-xs font-bold text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-8 text-xs font-mono text-muted-foreground text-right">
        {Math.round(score)}
      </span>
    </div>
  );
}
