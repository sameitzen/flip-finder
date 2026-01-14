'use client';

import { ItemIdentity } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, MapPin } from 'lucide-react';

interface ItemIdentificationProps {
  item: ItemIdentity;
  imageBase64?: string;
}

export function ItemIdentification({ item, imageBase64 }: ItemIdentificationProps) {
  const confidencePercent = Math.round(item.confidence * 100);

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
      </CardContent>
    </Card>
  );
}
