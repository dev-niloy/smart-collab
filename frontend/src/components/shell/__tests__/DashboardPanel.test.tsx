import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

import { DashboardPanel } from '../DashboardPanel';

const wrap = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryWrapper';
  return Wrapper;
};

const fetchOk = (responses: Record<string, unknown>) =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    for (const [needle, body] of Object.entries(responses)) {
      if (url.includes(needle)) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({}), { status: 200 });
  });

const todayIso = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

describe('DashboardPanel', () => {
  let qc: QueryClient;
  let origFetch: typeof globalThis.fetch;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    origFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    qc.clear();
  });

  it('renders Dashboard header + Overview + 2 shortcut subroutes', async () => {
    globalThis.fetch = fetchOk({}) as typeof globalThis.fetch;
    render(<DashboardPanel />, { wrapper: wrap(qc) });
    expect(screen.getByRole('heading', { level: 2, name: /dashboard/i })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('href', '/dashboard');

    const myTasks = screen.getByRole('link', { name: /my open tasks/i });
    expect(myTasks).toHaveAttribute('href', '/dashboard/my-tasks');

    const deadlines = screen.getByRole('link', { name: /today's deadlines/i });
    expect(deadlines).toHaveAttribute('href', '/dashboard/deadlines');
  });

  it('shows myOpenTasks count badge when > 0', async () => {
    globalThis.fetch = fetchOk({
      '/api/v1/dashboard/kpis': { totalProjects: 1, totalTasks: 0, completedTasks: 0, completionPct: 0, myOpenTasks: 3 },
      '/api/v1/dashboard/upcoming': { tasks: [], projects: [] },
    }) as typeof globalThis.fetch;
    render(<DashboardPanel />, { wrapper: wrap(qc) });
    await waitFor(() => {
      expect(screen.getByTestId('panel-count-my-tasks')).toHaveTextContent('3');
    });
  });

  it("shows Today's Deadlines count of tasks due today", async () => {
    globalThis.fetch = fetchOk({
      '/api/v1/dashboard/kpis': { totalProjects: 0, totalTasks: 0, completedTasks: 0, completionPct: 0, myOpenTasks: 0 },
      '/api/v1/dashboard/upcoming': {
        tasks: [
          { id: 't1', title: 'A', dueDate: todayIso(), projectId: 'p1', priority: 'medium', status: 'todo' },
          { id: 't2', title: 'B', dueDate: todayIso(), projectId: 'p1', priority: 'high', status: 'in_progress' },
          { id: 't3', title: 'C', dueDate: '2099-01-01T00:00:00.000Z', projectId: 'p1', priority: 'low', status: 'todo' },
        ],
        projects: [],
      },
    }) as typeof globalThis.fetch;
    render(<DashboardPanel />, { wrapper: wrap(qc) });
    await waitFor(() => {
      expect(screen.getByTestId('panel-count-deadlines')).toHaveTextContent('2');
    });
  });

  it('hides badge entirely when count is 0', async () => {
    globalThis.fetch = fetchOk({
      '/api/v1/dashboard/kpis': { totalProjects: 0, totalTasks: 0, completedTasks: 0, completionPct: 0, myOpenTasks: 0 },
      '/api/v1/dashboard/upcoming': { tasks: [], projects: [] },
    }) as typeof globalThis.fetch;
    render(<DashboardPanel />, { wrapper: wrap(qc) });
    await waitFor(() => {
      expect(screen.queryByTestId('panel-count-my-tasks')).not.toBeInTheDocument();
      expect(screen.queryByTestId('panel-count-deadlines')).not.toBeInTheDocument();
    });
  });
});
