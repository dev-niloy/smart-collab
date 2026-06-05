import type { ReactNode } from 'react';

export interface PanelProps {
  children?: ReactNode;
  collapsed?: boolean;
}

export function Panel({ children, collapsed = false }: PanelProps) {
  if (collapsed) {
    return <div data-testid="shell-panel" data-collapsed="true" className="w-0 shrink-0" />;
  }
  return (
    <aside
      data-testid="shell-panel"
      data-collapsed="false"
      aria-label="Section navigation"
      className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-background"
    >
      {children}
    </aside>
  );
}
