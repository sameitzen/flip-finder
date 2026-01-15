'use client';

import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActiveListing } from '@/lib/types';
import { ExternalLink, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface CompsGalleryProps {
  listings: ActiveListing[];
  originalQuery: string;
}

export function CompsGallery({
  listings,
  originalQuery,
}: CompsGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build eBay search URL
  const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(originalQuery)}&_sop=12`;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
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
          <div>
            <CardTitle className="text-base font-medium">
              eBay Listings
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {listings.length} current asking prices
            </p>
          </div>
          <a
            href={ebaySearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View on eBay
          </a>
        </div>
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
            {listings.map((listing, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-28"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="w-full rounded-lg border border-border overflow-hidden">
                  {/* Image */}
                  <div className="aspect-square bg-muted relative">
                    {listing.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.imageUrl}
                        alt={listing.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No image
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
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price summary */}
        {listings.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price Range:</span>
              <span className="font-medium">
                ${Math.min(...listings.map((l) => l.currentPrice)).toFixed(2)} -{' '}
                ${Math.max(...listings.map((l) => l.currentPrice)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Avg Asking:</span>
              <span className="font-medium">
                $
                {(
                  listings.reduce((sum, l) => sum + l.currentPrice, 0) /
                  listings.length
                ).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
