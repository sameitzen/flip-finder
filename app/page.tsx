'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CameraViewfinder } from '@/components/camera';
import { scanItem } from '@/lib/actions/scan-item';

export default function Home() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCapture = async (imageBase64: string) => {
    setIsProcessing(true);

    try {
      const result = await scanItem(imageBase64);

      // Store result in sessionStorage for the results page
      sessionStorage.setItem('currentScan', JSON.stringify({
        ...result,
        imageBase64,
        timestamp: Date.now(),
      }));

      router.push('/results');
    } catch (error) {
      console.error('Scan failed:', error);
      setIsProcessing(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col">
      <CameraViewfinder
        onCapture={handleCapture}
        isProcessing={isProcessing}
      />
    </main>
  );
}
