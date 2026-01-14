'use client';

import { useEffect, useRef } from 'react';
import { useCamera } from '@/hooks/use-camera';
import { CaptureButton } from './capture-button';
import { CameraPermissions } from './camera-permissions';
import { Camera, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      {/* Video feed - takes remaining space */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          webkit-playsinline="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            minHeight: '100%',
            minWidth: '100%',
          }}
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
              className="absolute bottom-4 left-4 bg-black/30 hover:bg-black/50 text-white rounded-full"
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
          </>
        )}

      </div>

      {/* Capture button - compact for mobile */}
      <div className="flex-shrink-0 py-2 px-4 bg-gradient-to-t from-background to-transparent">
        <CaptureButton
          onCapture={handleCapture}
          disabled={status !== 'active' || isProcessing}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}
