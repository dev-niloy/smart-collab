import type { ReactNode } from 'react';

export interface TopbarProps {
  segments?: string[];
  actions?: ReactNode;
}

export function Topbar({ segments = [], actions }: TopbarProps) {
  return (
    <header
      data-testid="shell-topbar"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4 text-sm"
    >
      <nav aria-label="Breadcrumbs" className="flex items-center gap-2 text-muted-foreground">
        {segments.map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-border">/</span>}
            <span className={i === segments.length - 1 ? 'text-foreground' : undefined}>{seg}</span>
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  );
}
