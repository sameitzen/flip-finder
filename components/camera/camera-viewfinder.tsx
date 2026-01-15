'use client';

import { useEffect, useRef, useState } from 'react';
import { useCamera } from '@/hooks/use-camera';
import { CaptureButton } from './capture-button';
import { PhotoTray } from './photo-tray';
import { CameraPermissions } from './camera-permissions';
import { Camera, RefreshCw, Image as ImageIcon, Sparkles, Search, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Processing stages for the animated indicator
const PROCESSING_STAGES = [
  { icon: Sparkles, label: 'Identifying item...' },
  { icon: Search, label: 'Finding eBay comps...' },
  { icon: Calculator, label: 'Calculating V.E.S.T. score...' },
];

// Stage timing (ms) - roughly matches actual processing
const STAGE_DURATION = 4000;

const MAX_PHOTOS = 4;

interface CameraViewfinderProps {
  onAnalyze: (images: string[]) => void;
  isProcessing?: boolean;
  capturedPhotos: string[];
  onAddPhoto: (imageBase64: string) => void;
  onRemovePhoto: (index: number) => void;
  onImageError?: (message: string) => void;
}

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;
const MAX_FILE_SIZE_MB = 15;

/**
 * Check if a file is HEIC/HEIF format (not supported in browser)
 */
const isHeicFormat = (file: File): boolean => {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
};

/**
 * Compress and resize an image file to reduce upload size
 * Note: HEIC/HEIF formats are not supported in browsers and must be rejected upfront
 */
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Set a timeout for the entire operation (10 seconds)
    const timeoutId = setTimeout(() => {
      reject(new Error(`Image processing timed out for ${file.name}`));
    }, 10000);

    const clearTimeoutAndResolve = (result: string) => {
      clearTimeout(timeoutId);
      resolve(result);
    };

    const clearTimeoutAndReject = (error: Error) => {
      clearTimeout(timeoutId);
      reject(error);
    };

    // Helper to process loaded image
    const processImage = (img: HTMLImageElement, cleanup?: () => void): void => {
      try {
        if (cleanup) cleanup();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          clearTimeoutAndReject(new Error('Could not get canvas context'));
          return;
        }

        let { width, height } = img;

        // Check for zero dimensions (indicates load failure)
        if (width === 0 || height === 0) {
          clearTimeoutAndReject(new Error('Image has zero dimensions - may be corrupted or unsupported format'));
          return;
        }

        // Scale down if larger than max dimension
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height / width) * MAX_DIMENSION);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width / height) * MAX_DIMENSION);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

        // Check if conversion worked
        if (!base64 || base64 === 'data:,') {
          clearTimeoutAndReject(new Error('Failed to convert image to JPEG'));
          return;
        }

        const sizeKB = Math.round(base64.length * 0.75 / 1024);
        console.log(`Compressed uploaded image: ${width}x${height}, ~${sizeKB}KB`);

        clearTimeoutAndResolve(base64);
      } catch (err) {
        clearTimeoutAndReject(new Error(`Image processing error: ${err instanceof Error ? err.message : 'unknown'}`));
      }
    };

    // First read the file as a data URL
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;

      if (!dataUrl || dataUrl.length < 100) {
        clearTimeoutAndReject(new Error('File read resulted in empty or invalid data'));
        return;
      }

      // Create blob URL as fallback
      const blobUrl = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(blobUrl);

      const img = new Image();

      img.onload = () => processImage(img, cleanup);

      img.onerror = () => {
        console.log('Data URL load failed, trying blob URL...');

        // Try blob URL as fallback
        const img2 = new Image();
        img2.onload = () => processImage(img2, cleanup);
        img2.onerror = () => {
          cleanup();
          clearTimeoutAndReject(new Error(`Cannot load image "${file.name}" - format may not be supported by your browser`));
        };
        img2.src = blobUrl;
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      clearTimeoutAndReject(new Error(`Failed to read file "${file.name}"`));
    };

    reader.readAsDataURL(file);
  });
};

export function CameraViewfinder({
  onAnalyze,
  isProcessing = false,
  capturedPhotos,
  onAddPhoto,
  onRemovePhoto,
  onImageError,
}: CameraViewfinderProps) {
  const {
    videoRef,
    canvasRef,
    status,
    error,
    startCamera,
    stopCamera,
    captureImage,
    switchCamera,
    facingMode,
  } = useCamera();

  const hasStartedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingStage, setProcessingStage] = useState(0);

  // Animate through processing stages when isProcessing is true
  useEffect(() => {
    if (!isProcessing) {
      setProcessingStage(0);
      return;
    }

    const interval = setInterval(() => {
      setProcessingStage((prev) =>
        prev < PROCESSING_STAGES.length - 1 ? prev + 1 : prev
      );
    }, STAGE_DURATION);

    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    console.log(`Processing ${files.length} file(s)...`);

    // Handle multiple file selection with compression
    const filesToProcess = Math.min(files.length, MAX_PHOTOS - capturedPhotos.length);
    let hasError = false;

    for (let i = 0; i < filesToProcess; i++) {
      const file = files[i];
      const fileSizeMB = file.size / (1024 * 1024);
      console.log(`File ${i + 1}: ${file.name}, type: ${file.type}, size: ${fileSizeMB.toFixed(1)}MB`);

      // Check for HEIC format first - not supported in browsers
      if (isHeicFormat(file)) {
        console.log(`HEIC format detected: ${file.name}`);
        if (onImageError && !hasError) {
          hasError = true;
          onImageError('HEIC photos are not supported. Please use the camera button to take a photo, or convert your image to JPEG first.');
        }
        continue;
      }

      // Check file size
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        console.log(`File too large: ${fileSizeMB.toFixed(1)}MB`);
        if (onImageError && !hasError) {
          hasError = true;
          onImageError(`Image is too large (${fileSizeMB.toFixed(0)}MB). Please use a smaller image.`);
        }
        continue;
      }

      // Accept any image type (iOS sometimes reports empty type for non-HEIC)
      if (file.type.startsWith('image/') || file.type === '' || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        try {
          const base64 = await compressImage(file);
          onAddPhoto(base64);
          console.log(`Successfully processed file ${i + 1}`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Failed to process file ${i + 1}:`, errorMsg);
          // Report error to parent for graceful handling
          if (onImageError && !hasError) {
            hasError = true;
            // Check if it's likely a format issue
            if (errorMsg.includes('format') || errorMsg.includes('load') || errorMsg.includes('dimensions')) {
              onImageError(`Could not load "${file.name}". This image format may not be supported. Please use the camera button or try a JPEG/PNG image.`);
            } else if (errorMsg.includes('timed out')) {
              onImageError(`Image processing timed out. The file may be too large or corrupted. Please try a different photo.`);
            } else {
              onImageError(`Could not process image: ${errorMsg}`);
            }
          }
        }
      } else {
        console.log(`Skipping non-image file: ${file.type}`);
        if (onImageError && !hasError) {
          hasError = true;
          onImageError(`"${file.name}" is not a supported image format. Please use JPEG, PNG, GIF, or WebP.`);
        }
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    // Only start camera once on mount
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startCamera();
    }

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    if (capturedPhotos.length >= MAX_PHOTOS) return;

    const image = captureImage();
    if (image) {
      onAddPhoto(image);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  };

  const handleAnalyze = () => {
    if (capturedPhotos.length === 0) return;
    onAnalyze(capturedPhotos);
  };

  // Show permission request UI
  if (status === 'denied' || status === 'error') {
    return (
      <CameraPermissions
        status={status}
        error={error}
        onRetry={startCamera}
      />
    );
  }

  const canCapture = status === 'active' && capturedPhotos.length < MAX_PHOTOS && !isProcessing;
  const canAnalyze = capturedPhotos.length > 0 && !isProcessing;

  return (
    <div className="relative flex flex-col flex-1 bg-black">
      {/* Video feed container with border */}
      <div className="relative flex-1 overflow-hidden m-3 rounded-2xl">
        {/* Outer glow border */}
        <div className={cn(
          'absolute inset-0 rounded-2xl transition-all duration-500',
          isProcessing
            ? 'ring-2 ring-primary/50 shadow-[0_0_30px_rgba(74,222,128,0.3)]'
            : 'ring-1 ring-white/20'
        )} />

        {/* Inner border */}
        <div className="absolute inset-[1px] rounded-2xl overflow-hidden bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            {...{ 'webkit-playsinline': 'true' }}
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-all duration-300',
              isProcessing && 'brightness-75'
            )}
            style={{
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              minHeight: '100%',
              minWidth: '100%',
            }}
          />

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Loading state - waiting for camera */}
          {(status === 'idle' || status === 'requesting') && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-3">
                <Camera className="w-12 h-12 text-muted-foreground animate-pulse" />
                <p className="text-sm text-muted-foreground">
                  {status === 'requesting' ? 'Requesting camera access...' : 'Starting camera...'}
                </p>
              </div>
            </div>
          )}

          {/* Scanning indicator overlay - subtle, keeps video visible */}
          {isProcessing && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Scanning line animation */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />

              {/* Corner brackets that pulse */}
              <div className="absolute inset-4">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg animate-pulse" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg animate-pulse" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg animate-pulse" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg animate-pulse" />
              </div>

              {/* Processing stage indicator */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3">
                  {(() => {
                    const CurrentIcon = PROCESSING_STAGES[processingStage].icon;
                    return (
                      <>
                        <CurrentIcon className="w-5 h-5 text-primary animate-pulse" />
                        <span className="text-sm text-white font-medium">
                          {PROCESSING_STAGES[processingStage].label}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Targeting reticle - only when not processing and no photos yet */}
          {status === 'active' && !isProcessing && capturedPhotos.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 relative">
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60 rounded-br-lg" />
              </div>
            </div>
          )}

          {/* Camera switch button */}
          {status === 'active' && !isProcessing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={switchCamera}
              className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          )}

          {/* Gallery upload button */}
          {status === 'active' && !isProcessing && capturedPhotos.length < MAX_PHOTOS && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 left-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm"
              >
                <ImageIcon className="w-5 h-5" />
              </Button>
            </>
          )}

          {/* Photo tray - shows captured photos */}
          {capturedPhotos.length > 0 && !isProcessing && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              <PhotoTray
                photos={capturedPhotos}
                onRemove={onRemovePhoto}
                maxPhotos={MAX_PHOTOS}
              />
            </div>
          )}
        </div>
      </div>

      {/* Capture/Analyze button area */}
      <div className="flex-shrink-0 py-4 px-4">
        <CaptureButton
          onCapture={handleCapture}
          onAnalyze={handleAnalyze}
          disabled={!canCapture && !canAnalyze}
          isProcessing={isProcessing}
          hasPhotos={capturedPhotos.length > 0}
          photoCount={capturedPhotos.length}
          maxPhotos={MAX_PHOTOS}
        />
      </div>
    </div>
  );
}
