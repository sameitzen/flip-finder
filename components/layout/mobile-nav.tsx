'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/',
    label: 'Scan',
    icon: Camera,
  },
  {
    href: '/history',
    label: 'History',
    icon: History,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  // Hide nav on results page for cleaner UX
  if (pathname.startsWith('/results')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-4 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-lg transition-colors touch-target',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-primary')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
