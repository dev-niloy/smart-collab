'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UpcomingPayload } from '@/lib/schemas/dashboard';
import { fmtDate } from '@/lib/task-format';

export interface UpcomingListProps {
  data: UpcomingPayload | undefined;
  days?: number;
  loading?: boolean;
  error?: boolean;
}

export function UpcomingList({ data, days = 7, loading, error }: UpcomingListProps) {
  const empty = !data || (data.tasks.length === 0 && data.projects.length === 0);

  return (
    <Card data-testid="upcoming-list">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Upcoming (next {days} days)</CardTitle>
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
        ) : empty ? (
          <p className="text-sm text-muted-foreground">Nothing in the next {days} days.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data!.tasks.map((t) => (
              <li key={`task-${t.id}`} className="flex items-center justify-between gap-2 py-2">
                <Link
                  href={`/projects/${t.projectId}/tasks/${t.id}`}
                  className="truncate hover:underline"
                >
                  {t.title}
                </Link>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    task
                  </Badge>
                  {fmtDate(t.dueDate)}
                </span>
              </li>
            ))}
            {data!.projects.map((p) => (
              <li key={`proj-${p.id}`} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/projects/${p.id}`} className="truncate hover:underline">
                  {p.name}
                </Link>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">
                    project
                  </Badge>
                  {fmtDate(p.deadline)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
