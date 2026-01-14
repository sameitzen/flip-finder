'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error' | 'denied';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureImage: () => string | null;
  switchCamera: () => Promise<void>;
  facingMode: 'user' | 'environment';
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('environment');

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, []);

  const startCameraWithMode = useCallback(async (mode: 'user' | 'environment') => {
    setStatus('requesting');
    setError(null);

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video metadata to load before playing
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;

          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            resolve();
          };

          const onError = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Video failed to load'));
          };

          // If already have metadata, resolve immediately
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            video.addEventListener('error', onError);
          }
        });

        await videoRef.current.play();
        setStatus('active');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';

      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setStatus('denied');
        setError('Camera access denied. Please enable camera permissions.');
      } else {
        setStatus('error');
        setError(message);
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    await startCameraWithMode(facingModeRef.current);
  }, [startCameraWithMode]);

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingModeRef.current === 'environment' ? 'user' : 'environment';
    facingModeRef.current = newFacingMode;
    setFacingMode(newFacingMode);

    if (status === 'active') {
      await startCameraWithMode(newFacingMode);
    }
  }, [status, startCameraWithMode]);

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current frame
    ctx.drawImage(video, 0, 0);

    // Compress and return as base64
    const base64 = canvas.toDataURL('image/jpeg', 0.8);

    // Trigger haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    return base64;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    startCamera,
    stopCamera,
    captureImage,
    switchCamera,
    facingMode,
  };
}
