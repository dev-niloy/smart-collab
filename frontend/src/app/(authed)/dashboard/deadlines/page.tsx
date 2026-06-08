'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUpcoming } from '@/hooks/useDashboard';
import { fmtDate } from '@/lib/task-format';

const RANGES: { value: number; label: string }[] = [
  { value: 1, label: 'Today' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

const startOfLocalDay = (d: Date): number => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return x.getTime();
};

export default function DeadlinesPage() {
  const [days, setDays] = useState<number>(7);
  const { data, isLoading, isError, refetch } = useUpcoming(undefined, days);

  const today = startOfLocalDay(new Date());

  const grouped = useMemo(() => {
    if (!data) return [] as { day: number; label: string; items: { kind: 'task' | 'project'; id: string; title: string; href: string; due: string }[] }[];
    const buckets = new Map<number, { kind: 'task' | 'project'; id: string; title: string; href: string; due: string }[]>();
    for (const t of data.tasks) {
      const k = startOfLocalDay(new Date(t.dueDate));
      const arr = buckets.get(k) ?? [];
      arr.push({ kind: 'task', id: t.id, title: t.title, href: `/projects/${t.projectId}/tasks/${t.id}`, due: t.dueDate });
      buckets.set(k, arr);
    }
    for (const p of data.projects) {
      const k = startOfLocalDay(new Date(p.deadline));
      const arr = buckets.get(k) ?? [];
      arr.push({ kind: 'project', id: p.id, title: p.name, href: `/projects/${p.id}`, due: p.deadline });
      buckets.set(k, arr);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        day,
        label: day === today ? 'Today' : day === today + 86_400_000 ? 'Tomorrow' : fmtDate(new Date(day).toISOString()),
        items,
      }));
  }, [data, today]);

  const totalCount = (data?.tasks.length ?? 0) + (data?.projects.length ?? 0);

  return (
    <div className="w-full flex-1 px-8 py-10">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <span className="text-eyebrow">Workspace · Deadlines</span>
          <h1 className="mt-2 text-display-md">Upcoming deadlines</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${totalCount} item${totalCount === 1 ? '' : 's'} in the next ${days} day${days === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1 surface-edge-highlight">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              aria-pressed={days === r.value}
              className={
                'rounded px-2.5 h-7 text-[11px] font-medium transition-colors ' +
                (days === r.value
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 w-full animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-destructive" role="alert">Failed to load deadlines.</p>
              <Button variant="outline" onClick={() => refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Nothing due in this window. 🎉</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map((g) => (
              <section key={g.day}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{g.label}</span>
                  <span className="text-[11px] text-muted-foreground">{g.items.length}</span>
                </div>
                <Card>
                  <CardContent className="px-0 py-0">
                    <ul className="divide-y divide-border">
                      {g.items.map((it) => (
                        <li key={`${it.kind}-${it.id}`} className="px-4 py-3 hover:bg-accent/40 transition-colors">
                          <Link
                            href={it.href}
                            className="flex items-center justify-between gap-3 focus:outline-none"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{it.title}</div>
                              <div className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                                Due {fmtDate(it.due)}
                              </div>
                            </div>
                            <Badge variant={it.kind === 'project' ? 'secondary' : 'outline'} className="text-[10px] shrink-0">
                              {it.kind}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
