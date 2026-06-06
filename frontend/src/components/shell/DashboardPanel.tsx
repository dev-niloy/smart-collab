'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { useKpis, useUpcoming } from '@/hooks/useDashboard';

interface DashboardLink {
  key: 'my-tasks' | 'deadlines';
  href: string;
  label: string;
  icon: typeof CalendarDays;
}

const LINKS: DashboardLink[] = [
  { key: 'my-tasks', href: '/dashboard#my-open-tasks', label: 'My Open Tasks', icon: CheckCircle2 },
  { key: 'deadlines', href: '/dashboard#upcoming-deadlines', label: "Today's Deadlines", icon: CalendarDays },
];

const startOfLocalDay = (d: Date): number => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return x.getTime();
};

const isToday = (dueDate: string | Date): boolean => {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return startOfLocalDay(due) === startOfLocalDay(new Date());
};

export function DashboardPanel() {
  const kpis = useKpis(undefined);
  const upcoming = useUpcoming(undefined, 1);

  const myOpenCount = kpis.data?.myOpenTasks ?? null;
  const todayCount = useMemo(() => {
    if (!upcoming.data) return null;
    return upcoming.data.tasks.filter((t) => isToday(t.dueDate)).length;
  }, [upcoming.data]);

  const counts: Record<DashboardLink['key'], number | null> = {
    'my-tasks': myOpenCount,
    deadlines: todayCount,
  };

  return (
    <div data-testid="dashboard-panel" className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Dashboard</h2>
      </div>
      <nav aria-label="Dashboard shortcuts" className="flex flex-col gap-1 p-2">
        {LINKS.map((link) => {
          const Icon = link.icon;
          const count = counts[link.key];
          const accessibleLabel =
            count !== null && count > 0 ? `${link.label} (${count})` : link.label;
          return (
            <Link
              key={link.key}
              href={link.href}
              aria-label={accessibleLabel}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                {link.label}
              </span>
              {count !== null && count > 0 ? (
                <span
                  data-testid={`panel-count-${link.key}`}
                  aria-hidden
                  className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground ring-1 ring-foreground/10"
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
