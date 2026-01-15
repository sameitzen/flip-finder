'use client';

import { useState } from 'react';
import { ItemIdentity } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, MapPin, Edit3, Send, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemIdentificationProps {
  item: ItemIdentity;
  images?: string[];
  onCorrect?: (description: string) => Promise<void>;
  isCorreecting?: boolean;
}

export function ItemIdentification({
  item,
  images = [],
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

  // Display up to 4 images in a clean grid
  const displayImages = images.slice(0, 4);
  const hasMultipleImages = displayImages.length > 1;

  return (
    <Card className="border-border/50 bg-card/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Image gallery - responsive grid */}
        {displayImages.length > 0 && (
          <div className={cn(
            'grid gap-1 p-3 bg-muted/30',
            displayImages.length === 1 && 'grid-cols-1',
            displayImages.length === 2 && 'grid-cols-2',
            displayImages.length >= 3 && 'grid-cols-2'
          )}>
            {displayImages.map((img, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg overflow-hidden bg-muted',
                  // First image larger when there are 3+ images
                  displayImages.length >= 3 && idx === 0 && 'col-span-2 aspect-video',
                  // Other images are square
                  !(displayImages.length >= 3 && idx === 0) && 'aspect-square'
                )}
              >
                <img
                  src={img}
                  alt={idx === 0 ? item.name : `Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Item details */}
        <div className="p-4">
          <h2 className="font-semibold text-lg leading-tight line-clamp-2">
            {item.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {item.category}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
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

          {/* Wrong identification CTA - more prominent */}
          {onCorrect && !showCorrectInput && (
            <Button
              onClick={() => setShowCorrectInput(true)}
              disabled={isCorreecting}
              variant="outline"
              size="sm"
              className="mt-4 w-full gap-2 border-dashed"
            >
              <Edit3 className="w-4 h-4" />
              Wrong item? Tell us what it is
            </Button>
          )}

          {/* Correction input */}
          {showCorrectInput && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                What is this item?
              </p>
              <div className="flex gap-2">
                <Input
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="e.g., Schwinn Airdyne exercise bike"
                  className="flex-1 h-10"
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
                  className="h-10 px-4"
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
                  className="h-10 px-2"
                  disabled={isCorreecting}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
