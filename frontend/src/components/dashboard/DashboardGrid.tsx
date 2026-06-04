'use client';

import { Header } from '@/components/header';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { StatusDonut } from '@/components/dashboard/StatusDonut';
import { PriorityBar } from '@/components/dashboard/PriorityBar';
import { ProductivityLine } from '@/components/dashboard/ProductivityLine';
import { UpcomingList } from '@/components/dashboard/UpcomingList';
import { HighPriorityList } from '@/components/dashboard/HighPriorityList';
import {
  useKpis,
  useStatusCounts,
  usePriorityCounts,
  useProductivity,
  useUpcoming,
  useHighPriority,
} from '@/hooks/useDashboard';
import { useScopedActivity } from '@/hooks/useActivity';
import { ActivityFeed } from '@/components/activity/ActivityFeed';

export interface DashboardGridProps {
  projectId?: string;
}

export function DashboardGrid({ projectId }: DashboardGridProps) {
  const kpis = useKpis(projectId);
  const status = useStatusCounts(projectId);
  const priority = usePriorityCounts(projectId);
  const productivity = useProductivity(projectId, 30);
  const upcoming = useUpcoming(projectId, 7);
  const highPriority = useHighPriority(projectId);
  const activityQuery = useScopedActivity(projectId, { limit: 10 });

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {projectId ? 'Project dashboard' : 'Dashboard'}
        </h1>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Projects"
            value={kpis.data?.totalProjects}
            loading={kpis.isLoading}
            error={kpis.isError}
          />
          <KpiCard
            title="Tasks"
            value={kpis.data?.totalTasks}
            sub={kpis.data ? `${kpis.data.completionPct}% completed` : undefined}
            loading={kpis.isLoading}
            error={kpis.isError}
          />
          <KpiCard
            title="Completed"
            value={kpis.data?.completedTasks}
            loading={kpis.isLoading}
            error={kpis.isError}
          />
          <KpiCard
            title="My open tasks"
            value={kpis.data?.myOpenTasks}
            loading={kpis.isLoading}
            error={kpis.isError}
          />
        </section>

        <section className="mt-6 grid gap-3 lg:grid-cols-2">
          <StatusDonut data={status.data} loading={status.isLoading} error={status.isError} />
          <PriorityBar data={priority.data} loading={priority.isLoading} error={priority.isError} />
        </section>

        <section className="mt-6">
          <ProductivityLine
            data={productivity.data}
            loading={productivity.isLoading}
            error={productivity.isError}
          />
        </section>

        <section className="mt-6 grid gap-3 lg:grid-cols-2">
          <UpcomingList
            data={upcoming.data}
            days={7}
            loading={upcoming.isLoading}
            error={upcoming.isError}
          />
          <HighPriorityList
            data={highPriority.data}
            loading={highPriority.isLoading}
            error={highPriority.isError}
          />
        </section>

        <section className="mt-6 rounded-lg border p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Recent activity</h2>
            {projectId ? (
              <a
                href={`/projects/${projectId}/activity`}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                View all →
              </a>
            ) : null}
          </div>
          <ActivityFeed query={activityQuery} hideLoadMore />
        </section>
      </main>
    </div>
  );
}
