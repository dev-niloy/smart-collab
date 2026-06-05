import type { ReactNode } from 'react';

export interface RailProps {
  children?: ReactNode;
}

export function Rail({ children }: RailProps) {
  return (
    <aside
      data-testid="shell-rail"
      aria-label="Primary navigation"
      className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-border bg-card py-2"
    >
      {children}
    </aside>
  );
}
