'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface KpiCardProps {
  title: string;
  value: number | string | undefined;
  sub?: string;
  progressPercent?: number;
  loading?: boolean;
  error?: boolean;
}

const fmtNum = (v: number | string | undefined): string => {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number') return v.toLocaleString();
  return v;
};

export function KpiCard({ title, value, sub, progressPercent, loading, error }: KpiCardProps) {
  return (
    <Card data-testid={`kpi-card-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <CardHeader className="pb-1.5">
        <CardTitle className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load
          </p>
        ) : (
          <>
            <div className="text-[32px] leading-none font-semibold tabular-nums tracking-[-0.025em]">{fmtNum(value)}</div>
            {typeof progressPercent === 'number' ? (
              <Progress
                value={progressPercent}
                aria-label={`${title} progress ${progressPercent} percent`}
                className="mt-3 flex-row [&_[data-slot=progress-track]]:h-1"
              />
            ) : null}
            {sub ? <p className="mt-2 text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
