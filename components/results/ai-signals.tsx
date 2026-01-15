'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AISignal {
  type: 'positive' | 'caution' | 'warning';
  message: string;
}

interface AISignalsProps {
  signals?: AISignal[];
  reasoning?: string;
  demandLevel?: 'high' | 'medium' | 'low';
  redFlags?: string[];
  confidence?: number;
}

export function AISignals({
  signals,
  reasoning,
  demandLevel,
  redFlags,
  confidence,
}: AISignalsProps) {
  // Build signals from existing data if not provided
  const displaySignals: AISignal[] = signals || buildSignalsFromData({
    reasoning,
    demandLevel,
    redFlags,
    confidence,
  });

  const positives = displaySignals.filter((s) => s.type === 'positive');
  const cautions = displaySignals.filter((s) => s.type === 'caution');
  const warnings = displaySignals.filter((s) => s.type === 'warning');

  if (displaySignals.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Positive signals */}
        {positives.length > 0 && (
          <div className="space-y-1.5">
            {positives.map((signal, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{signal.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Caution signals */}
        {cautions.length > 0 && (
          <div className="space-y-1.5">
            {cautions.map((signal, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{signal.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warning signals */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            {warnings.map((signal, i) => (
              <div key={i} className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-400">{signal.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Confidence indicator */}
        {confidence !== undefined && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">AI Confidence</span>
              <span className={cn(
                'font-medium',
                confidence >= 0.7 ? 'text-green-500' :
                confidence >= 0.4 ? 'text-yellow-500' : 'text-red-500'
              )}>
                {Math.round(confidence * 100)}%
                <span className="text-muted-foreground ml-1">
                  ({getConfidenceLabel(confidence)})
                </span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Good';
  if (confidence >= 0.4) return 'Moderate';
  return 'Low';
}

/**
 * Build structured signals from raw AI data
 * This converts the verbose reasoning into bullet points
 */
function buildSignalsFromData(data: {
  reasoning?: string;
  demandLevel?: 'high' | 'medium' | 'low';
  redFlags?: string[];
  confidence?: number;
}): AISignal[] {
  const signals: AISignal[] = [];

  // Add demand-based signals
  if (data.demandLevel === 'high') {
    signals.push({
      type: 'positive',
      message: 'High demand - items typically sell quickly',
    });
  } else if (data.demandLevel === 'low') {
    signals.push({
      type: 'caution',
      message: 'Low demand - may take longer to sell',
    });
  }

  // Parse reasoning for key insights
  if (data.reasoning) {
    const reasoning = data.reasoning.toLowerCase();

    // Positive indicators
    if (reasoning.includes('popular') || reasoning.includes('sought after')) {
      signals.push({ type: 'positive', message: 'Popular item with consistent buyer interest' });
    }
    if (reasoning.includes('brand') && (reasoning.includes('value') || reasoning.includes('holds'))) {
      signals.push({ type: 'positive', message: 'Brand holds resale value well' });
    }
    if (reasoning.includes('collectible') || reasoning.includes('collector')) {
      signals.push({ type: 'positive', message: 'Collectible item with dedicated market' });
    }
    if (reasoning.includes('vintage') && reasoning.includes('valuable')) {
      signals.push({ type: 'positive', message: 'Vintage items in this category are valued' });
    }

    // Caution indicators
    if (reasoning.includes('condition') && reasoning.includes('important')) {
      signals.push({ type: 'caution', message: 'Condition significantly affects value' });
    }
    if (reasoning.includes('verify') || reasoning.includes('check')) {
      signals.push({ type: 'caution', message: 'Verify authenticity and completeness' });
    }
    if (reasoning.includes('common') || reasoning.includes('abundant')) {
      signals.push({ type: 'caution', message: 'Common item - price competitively' });
    }

    // Warning indicators
    if (reasoning.includes('saturated') || reasoning.includes('flooded')) {
      signals.push({ type: 'warning', message: 'Market is saturated with similar listings' });
    }
    if (reasoning.includes('depreciate') || reasoning.includes('dropping')) {
      signals.push({ type: 'warning', message: 'Prices trending downward' });
    }
  }

  // Add red flags
  if (data.redFlags && data.redFlags.length > 0) {
    data.redFlags.forEach((flag) => {
      signals.push({ type: 'warning', message: flag });
    });
  }

  // Confidence-based signals
  if (data.confidence !== undefined) {
    if (data.confidence < 0.4) {
      signals.push({
        type: 'caution',
        message: 'Limited data available - estimate may be less accurate',
      });
    }
  }

  // Deduplicate by message
  const seen = new Set<string>();
  return signals.filter((s) => {
    if (seen.has(s.message)) return false;
    seen.add(s.message);
    return true;
  });
}

/**
 * Parse AI response to extract structured signals
 * Can be used when Gemini returns signals directly
 */
export function parseAISignals(aiResponse: {
  positive?: string[];
  cautions?: string[];
  warnings?: string[];
}): AISignal[] {
  const signals: AISignal[] = [];

  if (aiResponse.positive) {
    aiResponse.positive.forEach((msg) => {
      signals.push({ type: 'positive', message: msg });
    });
  }

  if (aiResponse.cautions) {
    aiResponse.cautions.forEach((msg) => {
      signals.push({ type: 'caution', message: msg });
    });
  }

  if (aiResponse.warnings) {
    aiResponse.warnings.forEach((msg) => {
      signals.push({ type: 'warning', message: msg });
    });
  }

  return signals;
}
