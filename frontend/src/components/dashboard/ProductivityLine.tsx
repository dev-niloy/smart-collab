'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { ProductivityPoint } from '@/lib/schemas/dashboard';

export interface ProductivityLineProps {
  data: ProductivityPoint[] | undefined;
  loading?: boolean;
  error?: boolean;
}

const fmtDay = (iso: string): string => {
  // 'YYYY-MM-DD' → 'M/D'
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
};

export function ProductivityLine({ data, loading, error }: ProductivityLineProps) {
  const total = data ? data.reduce((acc, p) => acc + p.completed, 0) : 0;
  const series = data ? data.map((p) => ({ ...p, label: fmtDay(p.date) })) : [];

  return (
    <Card data-testid="productivity-line">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Productivity ({data?.length ?? 0} days)</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load
          </p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="completed" stroke="#22c55e" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
