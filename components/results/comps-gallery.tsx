'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActiveListing } from '@/lib/types';
import { ExternalLink, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompsGalleryProps {
  listings: ActiveListing[];
  originalQuery: string;
  usedQuery?: string;
  queryBroadened?: boolean;
  broadeningExplanation?: string | null;
  onExclude?: (index: number, reason: string) => void;
  excludedIndices?: Set<number>;
}

const EXCLUSION_REASONS = [
  'Different model',
  'Wrong condition',
  'Incomplete/broken',
  'Outlier price',
  'Other',
];

export function CompsGallery({
  listings,
  originalQuery,
  usedQuery,
  queryBroadened,
  broadeningExplanation,
  onExclude,
  excludedIndices = new Set(),
}: CompsGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const activeListings = listings.filter((_, i) => !excludedIndices.has(i));
  const excludedCount = excludedIndices.size;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleExclude = (index: number, reason: string) => {
    if (onExclude) {
      onExclude(index, reason);
    }
    setSelectedIndex(null);
  };

  if (listings.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="font-medium">No comparable listings found</p>
              <p className="text-sm">Try a broader search or different keywords</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Comparable Listings ({activeListings.length})
            {excludedCount > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                ({excludedCount} excluded)
              </span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <ExternalLink className="w-3 h-3" />
            View on eBay
          </Button>
        </div>

        {/* Query broadening notice */}
        {queryBroadened && broadeningExplanation && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-500/10 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="text-yellow-500 font-medium">Search broadened</p>
              <p className="text-muted-foreground">{broadeningExplanation}</p>
              {usedQuery && usedQuery !== originalQuery && (
                <p className="text-muted-foreground mt-1">
                  Used: &quot;{usedQuery}&quot;
                </p>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Scroll container */}
        <div className="relative">
          {/* Scroll buttons */}
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-background/80 backdrop-blur rounded-full flex items-center justify-center shadow-lg border border-border hover:bg-background transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-background/80 backdrop-blur rounded-full flex items-center justify-center shadow-lg border border-border hover:bg-background transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Listings scroll */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide px-4 py-3"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {listings.map((listing, index) => {
              const isExcluded = excludedIndices.has(index);
              const isSelected = selectedIndex === index;

              return (
                <div
                  key={index}
                  className={cn(
                    'flex-shrink-0 w-28 transition-all duration-200',
                    isExcluded && 'opacity-40 order-last'
                  )}
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <button
                    onClick={() => setSelectedIndex(isSelected ? null : index)}
                    disabled={isExcluded}
                    className={cn(
                      'w-full rounded-lg border overflow-hidden transition-all',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50',
                      isExcluded && 'cursor-not-allowed'
                    )}
                  >
                    {/* Image placeholder */}
                    <div className="aspect-square bg-muted relative">
                      {listing.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.imageUrl}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No image
                        </div>
                      )}
                      {isExcluded && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <X className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Price and condition */}
                    <div className="p-2 bg-background">
                      <p className="text-sm font-bold text-foreground">
                        ${listing.currentPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {listing.condition}
                      </p>
                    </div>
                  </button>

                  {/* Exclusion menu */}
                  {isSelected && !isExcluded && onExclude && (
                    <div className="mt-2 p-2 bg-card border border-border rounded-lg shadow-lg">
                      <p className="text-xs font-medium mb-2">Exclude this listing?</p>
                      <div className="space-y-1">
                        {EXCLUSION_REASONS.map((reason) => (
                          <button
                            key={reason}
                            onClick={() => handleExclude(index, reason)}
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setSelectedIndex(null)}
                        className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Helper text */}
        {onExclude && (
          <p className="text-xs text-muted-foreground text-center pb-3">
            Tap listing to exclude • Recalculates instantly
          </p>
        )}

        {/* Price summary */}
        {activeListings.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price Range:</span>
              <span className="font-medium">
                ${Math.min(...activeListings.map((l) => l.currentPrice)).toFixed(2)} -{' '}
                ${Math.max(...activeListings.map((l) => l.currentPrice)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Avg Asking:</span>
              <span className="font-medium">
                $
                {(
                  activeListings.reduce((sum, l) => sum + l.currentPrice, 0) /
                  activeListings.length
                ).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
