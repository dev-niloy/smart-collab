import type { ReactNode } from 'react';
import { Rail } from './Rail';
import { Panel } from './Panel';
import { Topbar } from './Topbar';

export interface ShellLayoutProps {
  children: ReactNode;
  rail?: ReactNode;
  panel?: ReactNode;
  topbar?: ReactNode;
  panelCollapsed?: boolean;
}

export function ShellLayout({
  children,
  rail,
  panel,
  topbar,
  panelCollapsed = false,
}: ShellLayoutProps) {
  return (
    <div data-testid="shell-layout" className="flex h-screen overflow-hidden bg-background text-foreground">
      <Rail>{rail}</Rail>
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
