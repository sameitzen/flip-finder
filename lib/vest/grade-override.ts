/**
 * Grade Override System
 *
 * Hard-coded business rules that ensure fast-selling, profitable items
 * receive appropriate grades regardless of other factors.
 *
 * "A fast nickel beats a slow dime" - Cash flow is king for resellers.
 */

import { Grade } from '@/lib/types';

export interface OverrideInput {
  score: number;
  grade: Grade;
  daysToSell: number;
  netProfit: number;
  grossMargin: number;
  sellThroughRate: number;
}

export interface OverrideResult {
  originalGrade: Grade;
  originalScore: number;
  finalGrade: Grade;
  finalScore: number;
  overrideApplied: boolean;
  overrideReason: string | null;
  overrideType: string | null;
}

// Grade hierarchy for comparison (higher = better)
const GRADE_VALUES: Record<Grade, number> = {
  'A+': 17, 'A': 16, 'A-': 15,
  'B+': 14, 'B': 13, 'B-': 12,
  'C+': 11, 'C': 10, 'C-': 9,
  'D+': 8, 'D': 7, 'D-': 6,
  'F+': 5, 'F': 4, 'F-': 3,
};

// Minimum score for each grade
const GRADE_MIN_SCORES: Record<Grade, number> = {
  'A+': 95, 'A': 90, 'A-': 87,
  'B+': 83, 'B': 80, 'B-': 77,
  'C+': 73, 'C': 70, 'C-': 67,
  'D+': 63, 'D': 60, 'D-': 57,
  'F+': 53, 'F': 50, 'F-': 0,
};

// Override rules in priority order (first match wins)
interface OverrideRule {
  name: string;
  type: 'velocity' | 'margin' | 'market';
  condition: (input: OverrideInput) => boolean;
  minimumGrade: Grade;
  reason: string;
}

const OVERRIDE_RULES: OverrideRule[] = [
  // VELOCITY OVERRIDES - Fast sellers get priority
  {
    name: 'LIGHTNING_FLIP',
    type: 'velocity',
    condition: (i) => i.daysToSell <= 3 && i.netProfit >= 8 && i.grossMargin >= 0.20,
    minimumGrade: 'B+',
    reason: 'Lightning fast seller (≤3 days) with good profit',
  },
  {
    name: 'CASH_FLOW_KING',
    type: 'velocity',
    condition: (i) => i.daysToSell <= 5 && i.netProfit >= 5,
    minimumGrade: 'B',
    reason: 'Very fast velocity (≤5 days) with profit ≥$5',
  },
  {
    name: 'VELOCITY_CHAMPION',
    type: 'velocity',
    condition: (i) => i.daysToSell <= 7 && i.netProfit >= 10,
    minimumGrade: 'B+',
    reason: 'Fast velocity (≤7 days) with strong profit ≥$10',
  },
  {
    name: 'VELOCITY_STANDARD',
    type: 'velocity',
    condition: (i) => i.daysToSell <= 10 && i.netProfit >= 10,
    minimumGrade: 'B-',
    reason: 'Good velocity (≤10 days) with profit ≥$10',
  },
  {
    name: 'QUICK_FLIP',
    type: 'velocity',
    condition: (i) => i.daysToSell <= 7 && i.netProfit >= 5 && i.grossMargin >= 0.25,
    minimumGrade: 'B-',
    reason: 'Quick flip opportunity with acceptable margins',
  },

  // MARGIN OVERRIDES - High margin compensates for slower sales
  {
    name: 'PREMIUM_MARGIN',
    type: 'margin',
    condition: (i) => i.grossMargin >= 0.60 && i.netProfit >= 30,
    minimumGrade: 'B+',
    reason: 'Exceptional margin (≥60%) with profit ≥$30',
  },
  {
    name: 'HIGH_MARGIN_PLAY',
    type: 'margin',
    condition: (i) => i.grossMargin >= 0.50 && i.netProfit >= 25,
    minimumGrade: 'B',
    reason: 'High margin (≥50%) with profit ≥$25',
  },
  {
    name: 'SOLID_MARGIN',
    type: 'margin',
    condition: (i) => i.grossMargin >= 0.40 && i.netProfit >= 20,
    minimumGrade: 'B-',
    reason: 'Solid margin (≥40%) with profit ≥$20',
  },

  // MARKET OVERRIDES - Hot market indicators
  {
    name: 'HOT_MARKET',
    type: 'market',
    condition: (i) => i.sellThroughRate >= 0.65 && i.netProfit >= 8,
    minimumGrade: 'B',
    reason: 'Very hot market (≥65% sell-through) with decent profit',
  },
  {
    name: 'ACTIVE_MARKET',
    type: 'market',
    condition: (i) => i.sellThroughRate >= 0.50 && i.netProfit >= 10,
    minimumGrade: 'B-',
    reason: 'Active market (≥50% sell-through) with good profit',
  },
];

/**
 * Apply grade override rules based on velocity, margin, and market conditions
 */
export function applyGradeOverride(input: OverrideInput): OverrideResult {
  const originalGradeValue = GRADE_VALUES[input.grade];

  let bestOverride: {
    grade: Grade;
    reason: string;
    type: string;
    gradeValue: number;
  } | null = null;

  // Find the best applicable override
  for (const rule of OVERRIDE_RULES) {
    if (rule.condition(input)) {
      const ruleGradeValue = GRADE_VALUES[rule.minimumGrade];

      // Only apply if it would improve the grade
      if (ruleGradeValue > originalGradeValue) {
        // Keep the best override (highest grade boost)
        if (!bestOverride || ruleGradeValue > bestOverride.gradeValue) {
          bestOverride = {
            grade: rule.minimumGrade,
            reason: `${rule.name}: ${rule.reason}`,
            type: rule.type,
            gradeValue: ruleGradeValue,
          };
        }
      }
    }
  }

  if (bestOverride) {
    // Calculate adjusted score that matches the new grade
    const adjustedScore = Math.max(
      input.score,
      GRADE_MIN_SCORES[bestOverride.grade]
    );

    return {
      originalGrade: input.grade,
      originalScore: input.score,
      finalGrade: bestOverride.grade,
      finalScore: adjustedScore,
      overrideApplied: true,
      overrideReason: bestOverride.reason,
      overrideType: bestOverride.type,
    };
  }

  return {
    originalGrade: input.grade,
    originalScore: input.score,
    finalGrade: input.grade,
    finalScore: input.score,
    overrideApplied: false,
    overrideReason: null,
    overrideType: null,
  };
}

/**
 * Get all applicable overrides (for debugging/transparency)
 */
export function getApplicableOverrides(input: OverrideInput): {
  name: string;
  type: string;
  minimumGrade: Grade;
  reason: string;
  wouldApply: boolean;
}[] {
  const originalGradeValue = GRADE_VALUES[input.grade];

  return OVERRIDE_RULES
    .filter((rule) => rule.condition(input))
    .map((rule) => ({
      name: rule.name,
      type: rule.type,
      minimumGrade: rule.minimumGrade,
      reason: rule.reason,
      wouldApply: GRADE_VALUES[rule.minimumGrade] > originalGradeValue,
    }));
}

/**
 * Get a user-friendly explanation of why an override was applied
 */
export function getOverrideExplanation(result: OverrideResult): string | null {
  if (!result.overrideApplied) {
    return null;
  }

  const gradeImprovement = `${result.originalGrade} → ${result.finalGrade}`;

  switch (result.overrideType) {
    case 'velocity':
      return `Grade boosted (${gradeImprovement}) due to fast sell time. Cash flow matters!`;
    case 'margin':
      return `Grade boosted (${gradeImprovement}) due to excellent profit margins.`;
    case 'market':
      return `Grade boosted (${gradeImprovement}) due to strong market demand.`;
    default:
      return `Grade boosted from ${gradeImprovement}`;
  }
}
