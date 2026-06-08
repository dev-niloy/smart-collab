'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/useTasks';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  fmtDate,
} from '@/lib/task-format';

export default function MyOpenTasksPage() {
  const { data, isLoading, isError, refetch } = useTasks({
    assignedTo: 'me',
    status: 'todo,in_progress',
    sort: 'dueDate',
    limit: 50,
  });
  const items = data?.data ?? [];

  return (
    <div className="w-full flex-1 px-8 py-10">
      <div className="border-b border-border pb-6">
        <span className="text-eyebrow">Workspace · Personal</span>
        <h1 className="mt-2 text-display-md">My open tasks</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isLoading
            ? 'Loading…'
            : items.length === 0
              ? 'Nothing assigned to you right now.'
              : `${items.length} open task${items.length === 1 ? '' : 's'}, sorted by due date.`}
        </p>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-2" data-testid="my-tasks-loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-destructive" role="alert">Failed to load tasks.</p>
              <Button variant="outline" onClick={() => refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">No open tasks assigned to you.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="px-0 py-0">
              <ul className="divide-y divide-border">
                {items.map((t) => (
                  <li key={t.id} className="px-4 py-3 hover:bg-accent/40 transition-colors">
                    <Link
                      href={`/projects/${t.projectId}/tasks/${t.id}`}
                      className="flex items-center justify-between gap-3 focus:outline-none"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{t.title}</div>
                        <div className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                          Due {fmtDate(t.dueDate)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={PRIORITY_VARIANT[t.priority]} className="text-[10px]">
                          {PRIORITY_LABEL[t.priority]}
                        </Badge>
                        <Badge variant={STATUS_VARIANT[t.status]} className="text-[10px]">
                          {STATUS_LABEL[t.status]}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
