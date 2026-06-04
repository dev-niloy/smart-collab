'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { StatusCounts } from '@/lib/schemas/dashboard';

const COLORS: Record<keyof StatusCounts, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#22c55e',
};
const LABELS: Record<keyof StatusCounts, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export interface StatusDonutProps {
  data: StatusCounts | undefined;
  loading?: boolean;
  error?: boolean;
}

export function StatusDonut({ data, loading, error }: StatusDonutProps) {
  const total = data ? data.todo + data.in_progress + data.completed : 0;
  const rows = data
    ? (Object.keys(data) as (keyof StatusCounts)[]).map((k) => ({
        name: LABELS[k],
        value: data[k],
        key: k,
      }))
    : [];

  return (
    <Card data-testid="status-donut">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tasks by status</CardTitle>
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
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {rows.map((r) => (
                  <Cell key={r.key} fill={COLORS[r.key]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
