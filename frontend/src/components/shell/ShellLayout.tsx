import type { ReactNode } from 'react';
import { Rail } from './Rail';
import { Panel } from './Panel';
import { Topbar } from './Topbar';

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
  return (
    <div data-testid="shell-layout" className="flex h-screen overflow-hidden bg-background text-foreground">
      <Rail bottom={railBottom} onSearchClick={onSearchClick} />
      <Panel collapsed={panelCollapsed}>{panel}</Panel>
      <div className="flex flex-1 flex-col overflow-hidden">
        {topbar ?? <Topbar />}
        <main data-testid="shell-main" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
