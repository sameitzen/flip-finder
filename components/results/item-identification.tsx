'use client';

import { useState } from 'react';
import { ItemIdentity } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, MapPin, Edit3, Send, X, Loader2 } from 'lucide-react';

interface ItemIdentificationProps {
  item: ItemIdentity;
  imageBase64?: string;
  onCorrect?: (description: string) => Promise<void>;
  isCorreecting?: boolean;
}

export function ItemIdentification({
  item,
  imageBase64,
  onCorrect,
  isCorreecting = false,
}: ItemIdentificationProps) {
  const [showCorrectInput, setShowCorrectInput] = useState(false);
  const [correction, setCorrection] = useState('');
  const confidencePercent = Math.round(item.confidence * 100);

  const handleSubmitCorrection = async () => {
    if (!correction.trim() || !onCorrect) return;
    await onCorrect(correction.trim());
    setShowCorrectInput(false);
    setCorrection('');
  };

  return (
    <Card className="border-border/50 bg-card/50 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Item image */}
          {imageBase64 && (
            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              <img
                src={imageBase64}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Item details */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base leading-tight line-clamp-2">
              {item.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {item.category}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                {confidencePercent}% match
              </Badge>

              {item.condition && (
                <Badge variant="outline" className="text-xs capitalize">
                  {item.condition}
                </Badge>
              )}

              {item.isPNWTreasure && (
                <Badge className="text-xs bg-vest-buy/20 text-vest-buy border-vest-buy/50">
                  <MapPin className="w-3 h-3 mr-1" />
                  PNW Treasure
                </Badge>
              )}

              {item.era && (
                <Badge variant="outline" className="text-xs">
                  {item.era}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Not quite right? correction section */}
        {onCorrect && (
          <div className="border-t border-border/50 px-4 py-3">
            {!showCorrectInput ? (
              <button
                onClick={() => setShowCorrectInput(true)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Not quite right? Correct it
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  What is this item actually?
                </p>
                <div className="flex gap-2">
                  <Input
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder="e.g., Schwinn Airdyne exercise bike"
                    className="flex-1 h-9 text-sm"
                    disabled={isCorreecting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && correction.trim()) {
                        handleSubmitCorrection();
                      }
                      if (e.key === 'Escape') {
                        setShowCorrectInput(false);
                        setCorrection('');
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    onClick={handleSubmitCorrection}
                    disabled={!correction.trim() || isCorreecting}
                    size="sm"
                    className="h-9 px-3"
                  >
                    {isCorreecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCorrectInput(false);
                      setCorrection('');
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2"
                    disabled={isCorreecting}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
