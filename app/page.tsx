'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CameraViewfinder } from '@/components/camera';
import { scanItem, identifyFromText, ScanError } from '@/lib/actions/scan-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, X, RefreshCw, Send } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ScanError | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textDescription, setTextDescription] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const handleCapture = async (imageBase64: string) => {
    setIsProcessing(true);
    setError(null);
    setCapturedImage(imageBase64);

    const result = await scanItem(imageBase64);

    if (result.success) {
      // Store result in sessionStorage for the results page
      sessionStorage.setItem('currentScan', JSON.stringify({
        ...result.data,
        imageBase64,
        timestamp: Date.now(),
      }));

      router.push('/results');
    } else {
      console.error('Scan failed:', result.error);
      setError(result.error);
      setIsProcessing(false);

      // If the error suggests text input, show the text input field
      if (result.error.suggestTextInput) {
        setShowTextInput(true);
      }
    }
  };

  const handleRetry = () => {
    setError(null);
    setShowTextInput(false);
    setTextDescription('');
    setCapturedImage(null);
  };

  const handleTextSubmit = async () => {
    if (!textDescription.trim()) return;

    setIsProcessing(true);
    setError(null);

    const result = await identifyFromText(textDescription.trim());

    if (result.success) {
      sessionStorage.setItem('currentScan', JSON.stringify({
        ...result.data,
        imageBase64: capturedImage || '',
        timestamp: Date.now(),
      }));

      router.push('/results');
    } else {
      setError(result.error);
      setIsProcessing(false);
    }
  };

  const dismissError = () => {
    setError(null);
    setShowTextInput(false);
  };

  return (
    <main className="flex-1 flex flex-col h-full min-h-0 relative">
      <CameraViewfinder
        onCapture={handleCapture}
        isProcessing={isProcessing}
      />

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-50">
          <div className="w-full max-w-sm space-y-4">
            {/* Error message */}
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{error.message}</p>
                </div>
                <button
                  onClick={dismissError}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Text input fallback */}
            {showTextInput && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Describe the item instead:
                </p>
                <div className="flex gap-2">
                  <Input
                    value={textDescription}
                    onChange={(e) => setTextDescription(e.target.value)}
                    placeholder="e.g., Vintage Pendleton wool blanket"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && textDescription.trim()) {
                        handleTextSubmit();
                      }
                    }}
                  />
                  <Button
                    onClick={handleTextSubmit}
                    disabled={!textDescription.trim() || isProcessing}
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {error.retryable && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
              {!showTextInput && error.suggestTextInput && (
                <Button
                  onClick={() => setShowTextInput(true)}
                  className="flex-1"
                >
                  Describe Item
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
