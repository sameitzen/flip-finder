'use client';

import { useEffect } from 'react';
import { useCamera, CameraStatus } from '@/hooks/use-camera';
import { CaptureButton } from './capture-button';
import { CameraPermissions } from './camera-permissions';
import { Camera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraViewfinderProps {
  onCapture: (imageBase64: string) => void;
  isProcessing?: boolean;
}

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

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

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
    <div className="relative flex flex-col h-full bg-background">
      {/* Video feed */}
      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          // @ts-expect-error webkit-playsinline is required for iOS Safari
          webkit-playsinline="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading overlay */}
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

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing item...</p>
            </div>
          </div>
        )}

        {/* Targeting reticle */}
        {status === 'active' && !isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/50 rounded-lg">
              {/* Corner accents */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
          </div>
        )}

        {/* Camera switch button */}
        {status === 'active' && !isProcessing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={switchCamera}
            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white rounded-full"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Capture button - always in thumb zone */}
      <div className="flex-shrink-0 py-6 px-4 safe-bottom bg-gradient-to-t from-background to-transparent">
        <CaptureButton
          onCapture={handleCapture}
          disabled={status !== 'active' || isProcessing}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}
