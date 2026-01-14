'use client';

import { Camera, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CameraStatus } from '@/hooks/use-camera';

interface CameraPermissionsProps {
  status: CameraStatus;
  error: string | null;
  onRetry: () => void;
}

export function CameraPermissions({ status, error, onRetry }: CameraPermissionsProps) {
  const isDenied = status === 'denied';

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {isDenied ? (
              <AlertTriangle className="w-8 h-8 text-destructive" />
            ) : (
              <Camera className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <CardTitle>
            {isDenied ? 'Camera Access Denied' : 'Camera Error'}
          </CardTitle>
          <CardDescription>
            {isDenied
              ? 'Flip Finder needs camera access to scan items.'
              : error || 'Something went wrong with the camera.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDenied && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">To enable camera access:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open your browser settings</li>
                <li>Find site permissions</li>
                <li>Allow camera access for this site</li>
                <li>Refresh the page</li>
              </ol>
            </div>
          )}

          <Button onClick={onRetry} className="w-full" size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
