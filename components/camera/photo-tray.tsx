'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoTrayProps {
  photos: string[];
  onRemove: (index: number) => void;
  maxPhotos?: number;
}

export function PhotoTray({ photos, onRemove, maxPhotos = 4 }: PhotoTrayProps) {
  if (photos.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full">
      {photos.map((photo, index) => (
        <div
          key={index}
          className="relative w-12 h-12 rounded-lg overflow-hidden ring-2 ring-white/30"
        >
          <img
            src={photo}
            alt={`Captured ${index + 1}`}
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => onRemove(index)}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ))}

      {/* Empty slots indicator */}
      {photos.length < maxPhotos && (
        <div className="text-xs text-white/50 ml-1">
          {photos.length}/{maxPhotos}
        </div>
      )}
    </div>
  );
}
