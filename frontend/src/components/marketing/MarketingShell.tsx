import type { ReactNode } from 'react';
import { MarketingNav } from './MarketingNav';
import { MarketingFooter } from './MarketingFooter';
import { SplineBackground } from './SplineBackground';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <SplineBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}

