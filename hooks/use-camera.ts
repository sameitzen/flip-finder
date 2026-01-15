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
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (mountedRef.current) {
      setStatus('idle');
    }
  }, []);

  const startCameraWithMode = useCallback(async (mode: 'user' | 'environment') => {
    if (!mountedRef.current) return;

    setStatus('requesting');
    setError(null);

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Simpler constraints for better mobile compatibility
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not found');
      }

      video.srcObject = stream;

      // Wait for video to be ready to play
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 10000);

        const onCanPlay = () => {
          clearTimeout(timeoutId);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
          resolve();
        };

        const onError = (e: Event) => {
          clearTimeout(timeoutId);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
          reject(new Error('Video error: ' + (e as ErrorEvent).message));
        };

        // Check if already ready
        if (video.readyState >= 3) {
          clearTimeout(timeoutId);
          resolve();
        } else {
          video.addEventListener('canplay', onCanPlay);
          video.addEventListener('error', onError);
        }
      });

      if (!mountedRef.current) return;

      // Play the video
      await video.play();

      if (!mountedRef.current) return;

      setStatus('active');
    } catch (err) {
      if (!mountedRef.current) return;

      const message = err instanceof Error ? err.message : 'Failed to access camera';
      console.error('Camera error:', message);

      if (message.includes('Permission denied') ||
          message.includes('NotAllowedError') ||
          message.includes('permission')) {
        setStatus('denied');
        setError('Camera access denied. Please enable camera permissions in your browser settings.');
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

    // Target max dimension for uploads (keeps file size reasonable)
    const MAX_DIMENSION = 1024;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Calculate scaled dimensions while maintaining aspect ratio
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;

    if (videoWidth > MAX_DIMENSION || videoHeight > MAX_DIMENSION) {
      if (videoWidth > videoHeight) {
        targetWidth = MAX_DIMENSION;
        targetHeight = Math.round((videoHeight / videoWidth) * MAX_DIMENSION);
      } else {
        targetHeight = MAX_DIMENSION;
        targetWidth = Math.round((videoWidth / videoHeight) * MAX_DIMENSION);
      }
    }

    // Set canvas to target size (smaller than original)
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw scaled image
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    // Compress with lower quality for smaller file size
    const base64 = canvas.toDataURL('image/jpeg', 0.7);

    // Log size for debugging
    const sizeKB = Math.round(base64.length * 0.75 / 1024);
    console.log(`Captured image: ${targetWidth}x${targetHeight}, ~${sizeKB}KB`);

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
