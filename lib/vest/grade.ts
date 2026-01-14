import { Grade, Recommendation } from '@/lib/types';

const GRADE_THRESHOLDS: [number, Grade][] = [
  [95, 'A+'], [90, 'A'], [87, 'A-'],
  [83, 'B+'], [80, 'B'], [77, 'B-'],
  [73, 'C+'], [70, 'C'], [67, 'C-'],
  [63, 'D+'], [60, 'D'], [57, 'D-'],
  [53, 'F+'], [50, 'F'], [0, 'F-'],
];

export function scoreToGrade(score: number): Grade {
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (score >= threshold) return grade;
  }
  return 'F-';
}

export function scoreToRecommendation(score: number): Recommendation {
  if (score >= 85) return 'strong-buy';
  if (score >= 70) return 'buy';
  if (score >= 55) return 'hold';
  if (score >= 40) return 'pass';
  return 'strong-pass';
}

export function gradeToColor(grade: Grade): string {
  if (grade.startsWith('A')) return 'text-vest-buy';
  if (grade.startsWith('B')) return 'text-green-400';
  if (grade.startsWith('C')) return 'text-vest-hold';
  if (grade.startsWith('D')) return 'text-orange-400';
  return 'text-vest-pass';
}

export function gradeToBgColor(grade: Grade): string {
  if (grade.startsWith('A')) return 'bg-vest-buy/20';
  if (grade.startsWith('B')) return 'bg-green-400/20';
  if (grade.startsWith('C')) return 'bg-vest-hold/20';
  if (grade.startsWith('D')) return 'bg-orange-400/20';
  return 'bg-vest-pass/20';
}

export function recommendationToLabel(rec: Recommendation): string {
  const labels: Record<Recommendation, string> = {
    'strong-buy': 'STRONG BUY',
    'buy': 'BUY',
    'hold': 'HOLD',
    'pass': 'PASS',
    'strong-pass': 'STRONG PASS',
  };
  return labels[rec];
}

export function recommendationToColor(rec: Recommendation): string {
  const colors: Record<Recommendation, string> = {
    'strong-buy': 'text-vest-buy',
    'buy': 'text-green-400',
    'hold': 'text-vest-hold',
    'pass': 'text-orange-400',
    'strong-pass': 'text-vest-pass',
  };
  return colors[rec];
}
