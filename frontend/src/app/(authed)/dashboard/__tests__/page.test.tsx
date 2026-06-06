import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Providers } from '@/components/providers';

const { meSpy } = vi.hoisted(() => ({ meSpy: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({ me: () => meSpy(), logout: vi.fn() }));

const {
  kpisSpy,
  statusSpy,
  prioritySpy,
  productivitySpy,
  upcomingSpy,
  highPrioritySpy,
} = vi.hoisted(() => ({
  kpisSpy: vi.fn(),
  statusSpy: vi.fn(),
  prioritySpy: vi.fn(),
  productivitySpy: vi.fn(),
  upcomingSpy: vi.fn(),
  highPrioritySpy: vi.fn(),
}));

vi.mock('@/lib/dashboard', () => ({
  getKpis: (...a: unknown[]) => kpisSpy(...a),
  getStatusCounts: (...a: unknown[]) => statusSpy(...a),
  getPriorityCounts: (...a: unknown[]) => prioritySpy(...a),
  getProductivity: (...a: unknown[]) => productivitySpy(...a),
  getUpcoming: (...a: unknown[]) => upcomingSpy(...a),
  getHighPriority: (...a: unknown[]) => highPrioritySpy(...a),
}));

const { activitySpy, projectActivitySpy } = vi.hoisted(() => ({
  activitySpy: vi.fn(),
  projectActivitySpy: vi.fn(),
}));
vi.mock('@/lib/activity', () => ({
  listActivity: (...a: unknown[]) => activitySpy(...a),
  listProjectActivity: (...a: unknown[]) => projectActivitySpy(...a),
}));

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

import DashboardPage from '../page';

const setUser = (role: 'admin' | 'project_manager' | 'team_member' = 'admin') => {
  meSpy.mockResolvedValue({
    user: { id: 'u', email: 'me@x.co', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const seedHooks = () => {
  kpisSpy.mockResolvedValue({
    totalProjects: 3,
    totalTasks: 10,
    completedTasks: 4,
    completionPct: 40,
    myOpenTasks: 2,
    myCompletedTasks: 1,
    myCompletionPct: 33,
  });
  statusSpy.mockResolvedValue({ todo: 3, in_progress: 3, completed: 4 });
  prioritySpy.mockResolvedValue({ low: 3, medium: 4, high: 3 });
  productivitySpy.mockResolvedValue([{ date: '2026-06-04', completed: 1 }]);
  upcomingSpy.mockResolvedValue({ tasks: [], projects: [] });
  highPrioritySpy.mockResolvedValue([]);
  activitySpy.mockResolvedValue({ items: [], nextCursor: null });
  projectActivitySpy.mockResolvedValue({ items: [], nextCursor: null });
};

describe('DashboardPage (global)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser();
    seedHooks();
  });

  it('renders Dashboard title and 4 KPI cards', async () => {
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    expect(screen.getByRole('heading', { name: /^dashboard$/i })).toBeTruthy();
    await waitFor(() => expect(kpisSpy).toHaveBeenCalledWith(undefined));
    expect(screen.getByTestId('kpi-card-projects')).toBeTruthy();
    expect(screen.getByTestId('kpi-card-tasks')).toBeTruthy();
    expect(screen.getByTestId('kpi-card-completed')).toBeTruthy();
    expect(screen.getByTestId('kpi-card-my-open-tasks')).toBeTruthy();
  });

  it('My open tasks card shows aggregate progress bar + label', async () => {
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('kpi-card-my-open-tasks')).toHaveTextContent(
        '33% of your tasks done',
      ),
    );
    expect(
      screen
        .getAllByRole('progressbar')
        .some((b) => b.getAttribute('aria-valuenow') === '33'),
    ).toBe(true);
  });

  it('renders all 6 widget containers', async () => {
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByTestId('status-donut')).toBeTruthy());
    expect(screen.getByTestId('priority-bar')).toBeTruthy();
    expect(screen.getByTestId('productivity-line')).toBeTruthy();
    expect(screen.getByTestId('upcoming-list')).toBeTruthy();
    expect(screen.getByTestId('high-priority-list')).toBeTruthy();
  });

  it('passes undefined projectId to all hooks (global scope)', async () => {
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(kpisSpy).toHaveBeenCalled());
    expect(kpisSpy).toHaveBeenCalledWith(undefined);
    expect(statusSpy).toHaveBeenCalledWith(undefined);
    expect(prioritySpy).toHaveBeenCalledWith(undefined);
    expect(productivitySpy).toHaveBeenCalledWith(undefined, 30);
    expect(upcomingSpy).toHaveBeenCalledWith(undefined, 7);
    expect(highPrioritySpy).toHaveBeenCalledWith(undefined);
  });

  it('renders KPI values from hooks', async () => {
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('10')).toBeTruthy());
    expect(screen.getByText('3')).toBeTruthy(); // projects
    expect(screen.getByText(/40% completed/i)).toBeTruthy();
  });

  it('renders recent activity widget and calls global listActivity with limit=10', async () => {
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(activitySpy).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: /recent activity/i })).toBeTruthy();
    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it('does not call project activity client when global', async () => {
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(activitySpy).toHaveBeenCalled());
    expect(projectActivitySpy).not.toHaveBeenCalled();
  });

  it('does not render a "Load more" button on dashboard variant', async () => {
    activitySpy.mockResolvedValue({
      items: [
        {
          id: 'a-1',
          action: 'task.created',
          actorId: 'u',
          actorName: 'Me',
          entityType: 'task',
          entityId: 't-1',
          projectId: 'p-1',
          meta: { title: 'X' },
          createdAt: new Date().toISOString(),
        },
      ],
      nextCursor: 'CUR',
    });
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(activitySpy).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });
});
