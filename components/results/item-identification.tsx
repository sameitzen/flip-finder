'use client';

import { useState, useRef } from 'react';
import { ItemIdentity } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, MapPin, Edit3, Send, X, Loader2, Plus, Camera, Image as ImageIcon } from 'lucide-react';

interface ItemIdentificationProps {
  item: ItemIdentity;
  images?: string[];
  onCorrect?: (description: string) => Promise<void>;
  onAddImages?: (newImages: string[]) => Promise<void>;
  isCorreecting?: boolean;
  isRefining?: boolean;
}

export function ItemIdentification({
  item,
  images = [],
  onCorrect,
  onAddImages,
  isCorreecting = false,
  isRefining = false,
}: ItemIdentificationProps) {
  const [showCorrectInput, setShowCorrectInput] = useState(false);
  const [correction, setCorrection] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confidencePercent = Math.round(item.confidence * 100);

  const handleSubmitCorrection = async () => {
    if (!correction.trim() || !onCorrect) return;
    await onCorrect(correction.trim());
    setShowCorrectInput(false);
    setCorrection('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onAddImages) return;

    const newImages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        newImages.push(base64);
      }
    }

    if (newImages.length > 0) {
      await onAddImages(newImages);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const primaryImage = images[0];
  const additionalImages = images.slice(1);
  const MAX_ADDITIONAL_SLOTS = 3;
  const emptySlots = Math.max(0, MAX_ADDITIONAL_SLOTS - additionalImages.length);

  return (
    <Card className="border-border/50 bg-card/50 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Images section */}
          <div className="flex-shrink-0">
            <div className="flex gap-2">
              {/* Primary image */}
              {primaryImage && (
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={primaryImage}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Additional images + ghost slots */}
              <div className="flex flex-col gap-1">
                {/* Existing additional images */}
                {additionalImages.slice(0, MAX_ADDITIONAL_SLOTS).map((img, idx) => (
                  <div key={idx} className="w-9 h-9 rounded overflow-hidden bg-muted">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}

                {/* Ghost slots - dashed outlines for adding more photos */}
                {emptySlots > 0 && additionalImages.length < MAX_ADDITIONAL_SLOTS && (
                  <>
                    {Array.from({ length: Math.min(emptySlots, 2) }).map((_, idx) => (
                      <button
                        key={`ghost-${idx}`}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isRefining}
                        className="w-9 h-9 rounded border-2 border-dashed border-border/50 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </button>
                    ))}
                  </>
                )}

                {/* Overflow indicator */}
                {additionalImages.length > MAX_ADDITIONAL_SLOTS && (
                  <div className="w-9 h-9 rounded bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
                    +{additionalImages.length - MAX_ADDITIONAL_SLOTS}
                  </div>
                )}
              </div>
            </div>
          </div>

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

        {/* Action buttons: Add photos & Correct */}
        {(onAddImages || onCorrect) && (
          <div className="border-t border-border/50 px-4 py-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {!showCorrectInput ? (
              <div className="flex items-center gap-4">
                {/* Add more photos button */}
                {onAddImages && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRefining}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {isRefining ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    {isRefining ? 'Refining...' : 'Add more photos'}
                  </button>
                )}

                {/* Separator */}
                {onAddImages && onCorrect && (
                  <span className="text-border">|</span>
                )}

                {/* Correct button */}
                {onCorrect && (
                  <button
                    onClick={() => setShowCorrectInput(true)}
                    disabled={isCorreecting || isRefining}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Not quite right?
                  </button>
                )}
              </div>
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
