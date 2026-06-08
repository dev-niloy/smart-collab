'use client';

import type { ReactNode } from 'react';
import { Rail } from './Rail';
import { Panel } from './Panel';
import { Topbar } from './Topbar';
import { MobileDrawer } from './MobileDrawer';
import { useMediaQuery, MOBILE_MEDIA_QUERY } from '@/hooks/useMediaQuery';

export interface ShellLayoutProps {
  children: ReactNode;
  railBottom?: ReactNode;
  panel?: ReactNode;
  topbar?: ReactNode;
  panelCollapsed?: boolean;
  onSearchClick?: () => void;
}

export function ShellLayout({
  children,
  railBottom,
  panel,
  topbar,
  panelCollapsed = false,
  onSearchClick,
}: ShellLayoutProps) {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

  if (isMobile) {
    return (
      <div data-testid="shell-layout" data-mobile="true" className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 text-sm">
          <MobileDrawer>
            <Rail bottom={railBottom} onSearchClick={onSearchClick} />
            <Panel collapsed={false}>{panel}</Panel>
          </MobileDrawer>
          <div className="flex-1">{topbar ?? <Topbar />}</div>
        </header>
        <main data-testid="shell-main" className="flex-1 overflow-auto scroll-smooth">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div data-testid="shell-layout" data-mobile="false" className="flex h-screen overflow-hidden bg-background text-foreground">
      <Rail bottom={railBottom} onSearchClick={onSearchClick} />
      <Panel collapsed={panelCollapsed}>{panel}</Panel>
      <div className="flex flex-1 flex-col overflow-hidden">
        {topbar ?? <Topbar />}
        <main data-testid="shell-main" className="flex-1 overflow-auto scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
