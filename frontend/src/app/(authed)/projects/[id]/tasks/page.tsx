'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import { useInfiniteProjectTasks } from '@/hooks/useTasks';
import { useAssignableMembers, useProjectMembers } from '@/hooks/useProjectMembers';
import { useUser } from '@/hooks/useUser';
import { useRestoreTask } from '@/hooks/useTasks';
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
  UNASSIGNED,
  type TaskStatus,
  type TaskPriority,
  type SortKey,
  type Task,
} from '@/lib/schemas/task';
import { InlineStatusSelect } from '@/components/tasks/inline-status-select';
import { TaskAssigneesAvatars } from '@/components/tasks/TaskAssigneesAvatars';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { parseCsv, toCsv, parseDateParam } from '@/lib/queryString';
import { LayoutGrid, Columns3 } from 'lucide-react';

const SORT_LABEL: Record<SortKey, string> = {
  created: 'Newest',
  dueDate: 'Due date (soonest)',
  priority: 'Priority (high first)',
  updated: 'Recently updated',
};

const ALL = '__all__';

const parseStatusList = (v: string | null): TaskStatus[] => {
  const allowed = new Set<string>(TASK_STATUSES);
  return parseCsv(v).filter((s): s is TaskStatus => allowed.has(s));
};

const parsePriorityList = (v: string | null): TaskPriority[] => {
  const allowed = new Set<string>(TASK_PRIORITIES);
  return parseCsv(v).filter((p): p is TaskPriority => allowed.has(p));
};

const parseSort = (v: string | null): SortKey =>
  v && (SORT_KEYS as readonly string[]).includes(v) ? (v as SortKey) : 'created';

export default function ProjectTasksPage() {
  return (
    <Suspense fallback={null}>
      <ProjectTasksPageInner />
    </Suspense>
  );
}

function ProjectTasksPageInner() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const projectId = routeParams?.id ?? '';
  const params = useSearchParams();
  const { user } = useUser();
  const { data: members } = useProjectMembers(projectId);
  const isAdmin = user?.role === 'admin';
  const isProjectPm =
    !!user && !!members?.some((m) => m.userId === user.id && m.role === 'pm');
  const isPrivileged = isAdmin || isProjectPm;
  const canWriteFor = (t: Task): boolean => {
    if (isPrivileged) return true;
    if (!user) return false;
    return t.assignees.some((a) => a.userId === user.id);
  };

  const q = params.get('q') ?? '';
  const statusList = parseStatusList(params.get('status'));
  const priorityList = parsePriorityList(params.get('priority'));
  const assignedToRaw = params.get('assignedTo') ?? undefined;
  const assignedToMe = assignedToRaw === 'me';
  const sort = parseSort(params.get('sort'));
  const dueFrom = parseDateParam(params.get('dueFrom'));
  const dueTo = parseDateParam(params.get('dueTo'));
  const createdByMe = params.get('createdBy') === 'me';

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
    next.delete('page');
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

  const statusCsv = useMemo(() => toCsv(statusList), [statusList]);
  const priorityCsv = useMemo(() => toCsv(priorityList), [priorityList]);
  const showDeleted = isPrivileged && params.get('tab') === 'deleted';
  const view: 'grid' | 'board' = params.get('view') === 'board' ? 'board' : 'grid';
  const PAGE_LIMIT = 25;
  const queryParams = useMemo(
    () => ({
      q: q || undefined,
      status: statusCsv || undefined,
      priority: priorityCsv || undefined,
      assignedTo: assignedToRaw,
      createdBy: createdByMe ? 'me' : undefined,
      dueFrom,
      dueTo,
      sort,
      limit: PAGE_LIMIT,
      includeDeleted: showDeleted,
    }),
    [q, statusCsv, priorityCsv, assignedToRaw, createdByMe, dueFrom, dueTo, sort, showDeleted],
  );

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProjectTasks(projectId, queryParams);
  const restoreMutation = useRestoreTask();
  const usersQuery = useAssignableMembers(projectId);

  const items: Task[] = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.data),
    [data],
  );
  const total = data?.pages[0]?.total ?? 0;

  // Board view needs ALL tasks — eagerly fetch every remaining page.
  useEffect(() => {
    if (view !== 'board') return;
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [view, hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  // Grid view: infinite scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (view !== 'grid') return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [view, hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);
  const hasFilters =
    !!q ||
    statusList.length > 0 ||
    priorityList.length > 0 ||
    !!assignedToRaw ||
    !!dueFrom ||
    !!dueTo ||
    createdByMe;

  const toggleStatus = (s: TaskStatus) => {
    const next = statusList.includes(s)
      ? statusList.filter((x) => x !== s)
      : [...statusList, s];
    setParam({ status: next.length === 0 ? null : toCsv(next) });
  };
  const togglePriority = (p: TaskPriority) => {
    const next = priorityList.includes(p)
      ? priorityList.filter((x) => x !== p)
      : [...priorityList, p];
    setParam({ priority: next.length === 0 ? null : toCsv(next) });
  };

  return (
    <div className="flex flex-1 flex-col">
      <main className="w-full flex-1 px-8 py-10">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="text-eyebrow">Project · Work</span>
            <h1 className="mt-2 text-display-md">Tasks</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {total === 0 ? 'No results' : `${total} task${total === 1 ? '' : 's'}`}
              {showDeleted ? ' · showing deleted' : ''}
            </p>
          </div>
          <Button onClick={() => router.push(`/projects/${projectId}/tasks/new`)}>
            New Task
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isPrivileged ? (
            <div
              className="inline-flex rounded-md border border-border p-0.5"
              role="tablist"
              aria-label="Task view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!showDeleted}
                onClick={() => setParam({ tab: null, page: null })}
                className={
                  'rounded px-3 py-1 text-xs ' +
                  (!showDeleted ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')
                }
              >
                Active
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showDeleted}
                onClick={() => setParam({ tab: 'deleted', page: null })}
                className={
                  'rounded px-3 py-1 text-xs ' +
                  (showDeleted ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')
                }
              >
                Deleted
              </button>
            </div>
          ) : null}

          <div
            className="inline-flex rounded-md border border-border p-0.5"
            role="tablist"
            aria-label="Layout"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'grid'}
              onClick={() => setParam({ view: null })}
              className={
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs ' +
                (view === 'grid'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              <LayoutGrid className="size-3.5" />
              Grid
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'board'}
              onClick={() => setParam({ view: 'board' })}
              className={
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs ' +
                (view === 'board'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              <Columns3 className="size-3.5" />
              Board
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search by title"
            aria-label="Search tasks"
          />
          <Select
            value={assignedToRaw ?? ALL}
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

        <div className="mt-3 flex flex-col gap-3">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter by status"
          >
            <span className="text-xs text-muted-foreground">Status:</span>
            {TASK_STATUSES.map((s) => {
              const active = statusList.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={active}
                  className={
                    'rounded-full border px-3 py-0.5 text-xs transition-colors ' +
                    (active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted')
                  }
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filter by priority"
          >
            <span className="text-xs text-muted-foreground">Priority:</span>
            {TASK_PRIORITIES.map((p) => {
              const active = priorityList.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  aria-pressed={active}
                  className={
                    'rounded-full border px-3 py-0.5 text-xs transition-colors ' +
                    (active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted')
                  }
                >
                  {PRIORITY_LABEL[p]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Due from
              <input
                type="date"
                aria-label="Due from"
                value={dueFrom ?? ''}
                onChange={(e) => setParam({ dueFrom: e.target.value || null })}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Due to
              <input
                type="date"
                aria-label="Due to"
                value={dueTo ?? ''}
                onChange={(e) => setParam({ dueTo: e.target.value || null })}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setParam({ assignedTo: assignedToMe ? null : 'me' })
              }
              aria-pressed={assignedToMe}
              className={
                'rounded-full border px-3 py-0.5 text-xs transition-colors ' +
                (assignedToMe
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-muted')
              }
            >
              Assigned to me
            </button>
            <button
              type="button"
              onClick={() => setParam({ createdBy: createdByMe ? null : 'me' })}
              aria-pressed={createdByMe}
              className={
                'rounded-full border px-3 py-0.5 text-xs transition-colors ' +
                (createdByMe
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-muted')
              }
            >
              Created by me
            </button>
          </div>
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
                        setParam({
                          q: null,
                          status: null,
                          priority: null,
                          assignedTo: null,
                          createdBy: null,
                          dueFrom: null,
                          dueTo: null,
                        });
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
          ) : view === 'board' && !showDeleted ? (
            <KanbanBoard
              tasks={items}
              projectId={projectId}
              canWriteFor={canWriteFor}
            />
          ) : (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="tasks-grid"
            >
              {items.map((t) => {
                const assigneeUsers = t.assignees.map((a) => a.user);
                return (
                  <Card
                    key={t.id}
                    className="relative flex h-full flex-col transition-colors hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring"
                  >
                    <Link
                      href={`/projects/${projectId}/tasks/${t.id}`}
                      aria-label={`Open task ${t.title}`}
                      className="absolute inset-0 z-0 rounded-lg focus:outline-none"
                    />
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        <Badge variant={PRIORITY_VARIANT[t.priority]}>
                          {PRIORITY_LABEL[t.priority]}
                        </Badge>
                      </div>
                      <div className="relative z-10 flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                        <InlineStatusSelect task={t} canWrite={canWriteFor(t)} />
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-2 text-xs text-muted-foreground">
                      <p>Due {fmtDate(t.dueDate)}</p>
                      <div className="flex items-center gap-2">
                        <span>Assignees:</span>
                        <TaskAssigneesAvatars users={assigneeUsers} />
                      </div>
                      {showDeleted ? (
                        <div className="relative z-10 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={restoreMutation.isPending}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              restoreMutation.mutate(t.id);
                            }}
                          >
                            Restore
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Infinite scroll sentinel (grid view) */}
        {view === 'grid' && hasNextPage ? (
          <div ref={sentinelRef} className="mt-6 flex justify-center py-4">
            <span className="text-xs text-muted-foreground">
              {isFetchingNextPage ? 'Loading more…' : ''}
            </span>
          </div>
        ) : null}
        {items.length > 0 && !hasNextPage && total > items.length ? null : null}
        {items.length > 0 && !hasNextPage ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Showing {items.length} of {total}
          </p>
        ) : null}
      </main>
    </div>
  );
}
