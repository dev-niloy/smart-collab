'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface KpiCardProps {
  title: string;
  value: number | string | undefined;
  sub?: string;
  loading?: boolean;
  error?: boolean;
}

const fmtNum = (v: number | string | undefined): string => {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number') return v.toLocaleString();
  return v;
};

export function KpiCard({ title, value, sub, loading, error }: KpiCardProps) {
  return (
    <Card data-testid={`kpi-card-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load
          </p>
        ) : (
          <>
            <div className="text-3xl font-semibold tabular-nums">{fmtNum(value)}</div>
            {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
