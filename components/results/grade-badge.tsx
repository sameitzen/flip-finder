'use client';

import { Grade } from '@/lib/types';
import { gradeToColor, gradeToBgColor } from '@/lib/vest';
import { cn } from '@/lib/utils';

interface GradeBadgeProps {
  grade: Grade;
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export function GradeBadge({ grade, score, size = 'lg', showScore = true }: GradeBadgeProps) {
  const sizeClasses = {
    sm: 'w-16 h-16 text-2xl',
    md: 'w-24 h-24 text-4xl',
    lg: 'w-32 h-32 text-5xl',
  };

  const scoreSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-full',
        'border-4 transition-all duration-300',
        sizeClasses[size],
        gradeToBgColor(grade),
        gradeToColor(grade).replace('text-', 'border-')
      )}
    >
      <span className={cn('font-bold font-mono', gradeToColor(grade))}>
        {grade}
      </span>
      {showScore && (
        <span className={cn('text-muted-foreground', scoreSizeClasses[size])}>
          {score.toFixed(0)}/100
        </span>
      )}
    </div>
  );
}
