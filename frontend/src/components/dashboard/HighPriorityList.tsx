'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HighPriorityTask } from '@/lib/schemas/dashboard';
import { fmtDate } from '@/lib/task-format';

export interface HighPriorityListProps {
  data: HighPriorityTask[] | undefined;
  loading?: boolean;
  error?: boolean;
}

export function HighPriorityList({ data, loading, error }: HighPriorityListProps) {
  return (
    <Card data-testid="high-priority-list">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">High priority tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load
          </p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open high-priority tasks.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <Link
                  href={`/projects/${t.projectId}/tasks/${t.id}`}
                  className="truncate hover:underline"
                >
                  {t.title}
                </Link>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="destructive" className="text-[10px]">
                    high
                  </Badge>
                  {t.assignee ? (
                    <span className="max-w-24 truncate">{t.assignee.name}</span>
                  ) : (
                    <span className="italic">Unassigned</span>
                  )}
                  <span>{fmtDate(t.dueDate)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
