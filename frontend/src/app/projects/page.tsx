'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
import { useProjects } from '@/hooks/useProjects';
import { useRole } from '@/hooks/useUser';
import {
  PROJECT_STATUSES,
  SORT_KEYS,
  PROJECT_DEFAULT_LIMIT,
  type ProjectStatus,
  type SortKey,
  type Project,
} from '@/lib/schemas/project';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On hold',
};

const STATUS_VARIANT: Record<ProjectStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  completed: 'secondary',
  on_hold: 'outline',
};

const SORT_LABEL: Record<SortKey, string> = {
  created: 'Newest',
  deadline: 'Deadline (soonest)',
  updated: 'Recently updated',
};

const ALL = '__all__';

const parseStatus = (v: string | null): ProjectStatus | undefined =>
  v && (PROJECT_STATUSES as readonly string[]).includes(v) ? (v as ProjectStatus) : undefined;

const parseSort = (v: string | null): SortKey =>
  v && (SORT_KEYS as readonly string[]).includes(v) ? (v as SortKey) : 'created';

const parsePage = (v: string | null): number => {
  const n = v ? parseInt(v, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

export default function ProjectsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { role } = useRole();
  const canCreate = role === 'admin' || role === 'project_manager';

  const q = params.get('q') ?? '';
  const status = parseStatus(params.get('status'));
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
    if ('q' in patch || 'status' in patch || 'sort' in patch) {
      next.delete('page');
    }
    const qs = next.toString();
    router.replace(qs ? `/projects?${qs}` : '/projects');
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
    () => ({ q: q || undefined, status, sort, page, limit: PROJECT_DEFAULT_LIMIT }),
    [q, status, sort, page],
  );

  const { data, isLoading, isError, refetch } = useProjects(queryParams);

  const total = data?.total ?? 0;
  const limit = data?.limit ?? PROJECT_DEFAULT_LIMIT;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const items: Project[] = data?.data ?? [];

  const hasFilters = !!q || !!status;

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total === 0 ? 'No results' : `${total} project${total === 1 ? '' : 's'}`}
            </p>
          </div>
          {canCreate ? (
            <Button onClick={() => router.push('/projects/new')}>New Project</Button>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search by name"
            aria-label="Search projects"
            className="sm:max-w-sm"
          />
          <Select
            value={status ?? ALL}
            onValueChange={(v) => setParam({ status: v === ALL ? null : v })}
          >
            <SelectTrigger className="sm:w-44" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setParam({ sort: v })}>
            <SelectTrigger className="sm:w-56" aria-label="Sort">
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
              data-testid="projects-loading"
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
                <p className="text-sm text-muted-foreground">Failed to load projects.</p>
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
                    <p className="text-sm">No projects match your filters.</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQueryInput('');
                        setParam({ q: null, status: null });
                      }}
                    >
                      Clear filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm">No projects yet.</p>
                    {canCreate ? (
                      <Button onClick={() => router.push('/projects/new')}>
                        Create your first project
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="projects-grid"
            >
              {items.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                >
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardHeader className="flex flex-row items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-1 text-xs text-muted-foreground">
                      <p>Deadline {fmtDate(p.deadline)}</p>
                      <p>Created {fmtDate(p.createdAt)}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
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
