import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Providers } from '@/components/providers';

const { meSpy } = vi.hoisted(() => ({ meSpy: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'p-1' }),
}));
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

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

import ScopedDashboardPage from '../page';

describe('ScopedDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meSpy.mockResolvedValue({
      user: { id: 'u', email: 'me@x.co', name: 'Me', role: 'admin', createdAt: '', updatedAt: '' },
    });
    kpisSpy.mockResolvedValue({
      totalProjects: 1,
      totalTasks: 5,
      completedTasks: 2,
      completionPct: 40,
      myOpenTasks: 1,
    });
    statusSpy.mockResolvedValue({ todo: 2, in_progress: 1, completed: 2 });
    prioritySpy.mockResolvedValue({ low: 0, medium: 3, high: 2 });
    productivitySpy.mockResolvedValue([{ date: '2026-06-04', completed: 1 }]);
    upcomingSpy.mockResolvedValue({ tasks: [], projects: [] });
    highPrioritySpy.mockResolvedValue([]);
  });

  it('passes projectId into all hooks', async () => {
    render(
      <Providers>
        <ScopedDashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(kpisSpy).toHaveBeenCalledWith('p-1'));
    expect(statusSpy).toHaveBeenCalledWith('p-1');
    expect(prioritySpy).toHaveBeenCalledWith('p-1');
    expect(productivitySpy).toHaveBeenCalledWith('p-1', 30);
    expect(upcomingSpy).toHaveBeenCalledWith('p-1', 7);
    expect(highPrioritySpy).toHaveBeenCalledWith('p-1');
  });

  it('renders Project dashboard heading', async () => {
    render(
      <Providers>
        <ScopedDashboardPage />
      </Providers>,
    );
    expect(screen.getByRole('heading', { name: /project dashboard/i })).toBeTruthy();
  });

  it('renders all 6 widget containers', async () => {
    render(
      <Providers>
        <ScopedDashboardPage />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByTestId('status-donut')).toBeTruthy());
    expect(screen.getByTestId('priority-bar')).toBeTruthy();
    expect(screen.getByTestId('productivity-line')).toBeTruthy();
    expect(screen.getByTestId('upcoming-list')).toBeTruthy();
    expect(screen.getByTestId('high-priority-list')).toBeTruthy();
  });
});
