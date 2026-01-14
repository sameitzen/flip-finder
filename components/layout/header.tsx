'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
}

export function Header({ title, showBack }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine title based on route
  const getTitle = () => {
    if (title) return title;
    if (pathname === '/') return 'Flip Finder';
    if (pathname === '/history') return 'Scan History';
    if (pathname.startsWith('/results')) return 'Analysis';
    return 'Flip Finder';
  };

  // Show back button on results page
  const shouldShowBack = showBack ?? pathname.startsWith('/results');

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border safe-top">
      <div className="flex items-center h-14 px-4">
        {shouldShowBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="mr-2 -ml-2"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}

        <h1 className="text-lg font-semibold tracking-tight">
          {getTitle()}
        </h1>

        {/* Spacer for centering when back button is shown */}
        {shouldShowBack && <div className="w-10" />}
      </div>
    </header>
  );
}
