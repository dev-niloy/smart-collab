'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectTasks } from '@/hooks/useTasks';
import { useUsers } from '@/hooks/useUsers';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  fmtDate,
} from '@/lib/task-format';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  SORT_KEYS,
  TASK_DEFAULT_LIMIT,
  UNASSIGNED,
  type TaskStatus,
  type TaskPriority,
  type SortKey,
  type Task,
} from '@/lib/schemas/task';
import { InlineStatusSelect } from '@/components/tasks/inline-status-select';

const SORT_LABEL: Record<SortKey, string> = {
  created: 'Newest',
  dueDate: 'Due date (soonest)',
  priority: 'Priority (high first)',
  updated: 'Recently updated',
};

const ALL = '__all__';

const parseStatus = (v: string | null): TaskStatus | undefined =>
  v && (TASK_STATUSES as readonly string[]).includes(v) ? (v as TaskStatus) : undefined;

const parsePriority = (v: string | null): TaskPriority | undefined =>
  v && (TASK_PRIORITIES as readonly string[]).includes(v) ? (v as TaskPriority) : undefined;

const parseSort = (v: string | null): SortKey =>
  v && (SORT_KEYS as readonly string[]).includes(v) ? (v as SortKey) : 'created';

const parsePage = (v: string | null): number => {
  const n = v ? parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
};

export default function ProjectTasksPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const projectId = routeParams?.id ?? '';
  const params = useSearchParams();

  const q = params.get('q') ?? '';
  const status = parseStatus(params.get('status'));
  const priority = parsePriority(params.get('priority'));
  const assignedTo = params.get('assignedTo') ?? undefined;
  const sort = parseSort(params.get('sort'));
  const page = parsePage(params.get('page'));

  const [queryInput, setQueryInput] = useState(q);
  const [lastSyncedQ, setLastSyncedQ] = useState(q);
  if (q !== lastSyncedQ) {
    setLastSyncedQ(q);
    setQueryInput(q);
  }

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if ('q' in patch || 'status' in patch || 'priority' in patch || 'assignedTo' in patch || 'sort' in patch) {
      next.delete('page');
    }
    const qs = next.toString();
    router.replace(`/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`);
  };

  useEffect(() => {
    if (queryInput === q) return;
    const t = setTimeout(() => {
      setParam({ q: queryInput || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  const queryParams = useMemo(
    () => ({
      q: q || undefined,
      status,
      priority,
      assignedTo,
      sort,
      page,
      limit: TASK_DEFAULT_LIMIT,
    }),
    [q, status, priority, assignedTo, sort, page],
  );

  const { data, isLoading, isError, refetch } = useProjectTasks(projectId, queryParams);
  const usersQuery = useUsers();

  const total = data?.total ?? 0;
  const limit = data?.limit ?? TASK_DEFAULT_LIMIT;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const items: Task[] = data?.data ?? [];
  const hasFilters = !!q || !!status || !!priority || !!assignedTo;

  const assigneeMap = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    usersQuery.data?.forEach((u) => map.set(u.id, { name: u.name, email: u.email }));
    return map;
  }, [usersQuery.data]);

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to project
        </Link>

        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total === 0 ? 'No results' : `${total} task${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <Button onClick={() => router.push(`/projects/${projectId}/tasks/new`)}>
            New Task
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search by title"
            aria-label="Search tasks"
          />
          <Select
            value={status ?? ALL}
            onValueChange={(v) => setParam({ status: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priority ?? ALL}
            onValueChange={(v) => setParam({ priority: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All priorities</SelectItem>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={assignedTo ?? ALL}
            onValueChange={(v) => setParam({ assignedTo: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Filter by assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any assignee</SelectItem>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {(usersQuery.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setParam({ sort: v })}>
            <SelectTrigger aria-label="Sort">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="tasks-loading"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} aria-hidden="true">
                  <CardHeader>
                    <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 py-8">
                <p className="text-sm text-destructive" role="alert">
                  Failed to load tasks.
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 py-10">
                {hasFilters ? (
                  <>
                    <p className="text-sm">No tasks match your filters.</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQueryInput('');
                        setParam({ q: null, status: null, priority: null, assignedTo: null });
                      }}
                    >
                      Clear filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm">No tasks yet.</p>
                    <Button onClick={() => router.push(`/projects/${projectId}/tasks/new`)}>
                      Create your first task
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="tasks-grid"
            >
              {items.map((t) => {
                const assignee =
                  t.assignee ?? (t.assignedTo ? assigneeMap.get(t.assignedTo) ?? null : null);
                return (
                  <Card key={t.id} className="flex h-full flex-col">
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/projects/${projectId}/tasks/${t.id}`}
                          className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <CardTitle className="text-base hover:underline">{t.title}</CardTitle>
                        </Link>
                        <Badge variant={PRIORITY_VARIANT[t.priority]}>
                          {PRIORITY_LABEL[t.priority]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                        <InlineStatusSelect task={t} />
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-1 text-xs text-muted-foreground">
                      <p>Due {fmtDate(t.dueDate)}</p>
                      <p>
                        Assigned:{' '}
                        {assignee ? assignee.name : <span className="italic">Unassigned</span>}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setParam({ page: String(page - 1) })}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setParam({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
