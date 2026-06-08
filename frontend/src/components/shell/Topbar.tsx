import type { ReactNode } from 'react';
import Link from 'next/link';

export type BreadcrumbSegment = string | { label: string; href?: string };

export interface TopbarProps {
  segments?: BreadcrumbSegment[];
  actions?: ReactNode;
  leading?: ReactNode;
}

const normalize = (seg: BreadcrumbSegment): { label: string; href?: string } =>
  typeof seg === 'string' ? { label: seg } : seg;

export function Topbar({ segments = [], actions, leading }: TopbarProps) {
  const items = segments.map(normalize);

  return (
    <header
      data-testid="shell-topbar"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4 text-sm"
    >
      {leading ? <div className="flex items-center">{leading}</div> : null}
      <nav aria-label="Breadcrumbs" className="flex items-center gap-2 text-muted-foreground">
        {items.map((seg, i) => {
          const isLast = i === items.length - 1;
          const labelEl =
            seg.href && !isLast ? (
              <Link href={seg.href} className="hover:text-foreground hover:underline">
                {seg.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-foreground' : undefined}>{seg.label}</span>
            );
          return (
            <span key={`${seg.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-border">
                  /
                </span>
              )}
              {labelEl}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  );
}
