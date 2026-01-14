'use client';

import { useState } from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Share } from 'lucide-react';

export function InstallPrompt() {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if already installed or dismissed
  if (isInstalled || isDismissed) return null;

  // Don't show if not installable (not on Android) and not iOS
  if (!canInstall && !isIOS) return null;

  return (
    <Card className="fixed bottom-24 left-4 right-4 z-40 border-primary/50 bg-card/95 backdrop-blur-sm shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Download className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install Flip Finder</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS
                ? 'Tap Share, then "Add to Home Screen"'
                : 'Add to home screen for quick access'}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 -mr-2 -mt-2"
            onClick={() => setIsDismissed(true)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {isIOS ? (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Share className="w-4 h-4" />
            <span>Tap the share button below, then "Add to Home Screen"</span>
          </div>
        ) : canInstall ? (
          <Button
            onClick={promptInstall}
            className="w-full mt-3"
            size="sm"
          >
            Install App
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
