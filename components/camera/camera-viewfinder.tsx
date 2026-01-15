'use client';

import { useEffect, useRef } from 'react';
import { useCamera } from '@/hooks/use-camera';
import { CaptureButton } from './capture-button';
import { CameraPermissions } from './camera-permissions';
import { Camera, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CameraViewfinderProps {
  onCapture: (imageBase64: string) => void;
  isProcessing?: boolean;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function CameraViewfinder({ onCapture, isProcessing = false }: CameraViewfinderProps) {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith('image/')) {
      const base64 = await fileToBase64(file);
      onCapture(base64);
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
    const image = captureImage();
    if (image) {
      onCapture(image);
    }
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
            webkit-playsinline="true"
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
            </div>
          )}

          {/* Targeting reticle - only when not processing */}
          {status === 'active' && !isProcessing && (
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
          {status === 'active' && !isProcessing && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
        </div>
      </div>

      {/* Capture button area - integrated with processing state */}
      <div className="flex-shrink-0 py-4 px-4">
        <CaptureButton
          onCapture={handleCapture}
          disabled={status !== 'active'}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}
