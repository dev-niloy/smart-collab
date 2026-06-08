'use client';

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
      <main className="w-full flex-1 px-8 py-10">
        <div className="border-b border-border pb-6">
          <span className="text-eyebrow">{projectId ? 'Project · Overview' : 'Workspace · Overview'}</span>
          <h1 className="mt-2 text-display-md">
            {projectId ? 'Project dashboard' : 'Dashboard'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Live KPIs, velocity, and what needs attention next.
          </p>
        </div>

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
          <div id="my-open-tasks" className="scroll-mt-24">
            <KpiCard
              title="My open tasks"
              value={kpis.data?.myOpenTasks}
              sub={
                kpis.data
                  ? `${kpis.data.myCompletionPct}% of your tasks done`
                  : undefined
              }
              progressPercent={kpis.data?.myCompletionPct}
              loading={kpis.isLoading}
              error={kpis.isError}
            />
          </div>
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

        <section id="upcoming-deadlines" className="mt-6 grid scroll-mt-24 gap-3 lg:grid-cols-2">
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

        <section className="mt-6 rounded-lg border border-border bg-card surface-edge-highlight p-5">
          <div className="mb-4 flex items-baseline justify-between border-b border-border pb-3">
            <div>
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Activity</span>
              <h2 className="text-sm font-semibold tracking-tight">Recent activity</h2>
            </div>
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
