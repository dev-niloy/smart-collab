'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import type { PriorityCounts } from '@/lib/schemas/dashboard';

const COLORS: Record<keyof PriorityCounts, string> = {
  low: '#94a3b8',
  medium: '#f59e0b',
  high: '#ef4444',
};
const LABELS: Record<keyof PriorityCounts, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface PriorityBarProps {
  data: PriorityCounts | undefined;
  loading?: boolean;
  error?: boolean;
}

export function PriorityBar({ data, loading, error }: PriorityBarProps) {
  const total = data ? data.low + data.medium + data.high : 0;
  const rows = data
    ? (Object.keys(data) as (keyof PriorityCounts)[]).map((k) => ({
        name: LABELS[k],
        value: data[k],
        key: k,
      }))
    : [];

  return (
    <Card data-testid="priority-bar">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tasks by priority</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load
          </p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value">
                {rows.map((r) => (
                  <Cell key={r.key} fill={COLORS[r.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
