import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useKpis,
  useStatusCounts,
  usePriorityCounts,
  useProductivity,
  useUpcoming,
  useHighPriority,
  dashboardKey,
} from '../useDashboard';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const makeWrapper = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryProvider';
  return Wrapper;
};

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useDashboard hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useKpis global fetches /api/v1/dashboard/kpis', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(200, { totalProjects: 1, totalTasks: 0, completedTasks: 0, completionPct: 0, myOpenTasks: 0 }),
    );
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const { result } = renderHook(() => useKpis(undefined), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalProjects).toBe(1);
  });

  it('useKpis scoped uses different queryKey', () => {
    expect(dashboardKey(undefined, 'kpis')).toEqual(['dashboard', 'global', 'kpis']);
    expect(dashboardKey('p-1', 'kpis')).toEqual(['dashboard', 'scope', 'p-1', 'kpis']);
  });

  it('useStatusCounts fetches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { todo: 1, in_progress: 0, completed: 0 })));
    const qc = makeClient();
    const { result } = renderHook(() => useStatusCounts(undefined), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.todo).toBe(1);
  });

  it('usePriorityCounts fetches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { low: 0, medium: 0, high: 3 })));
    const qc = makeClient();
    const { result } = renderHook(() => usePriorityCounts('p-1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.high).toBe(3);
  });

  it('useProductivity passes days into queryKey + URL', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { data: [{ date: '2026-06-04', completed: 0 }] }));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const { result } = renderHook(() => useProductivity(undefined, 14), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/days=14$/),
      expect.anything(),
    );
  });

  it('useUpcoming returns {tasks,projects}', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { tasks: [], projects: [] })));
    const qc = makeClient();
    const { result } = renderHook(() => useUpcoming(undefined, 7), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.tasks).toEqual([]);
  });

  it('useHighPriority returns array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { data: [] })));
    const qc = makeClient();
    const { result } = renderHook(() => useHighPriority(undefined), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('useKpis 401 surfaces error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(401, { error: { code: 'MISSING_TOKEN', message: 'no' } }, false)),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useKpis(undefined), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('dashboardKey w/ days appends days to key', () => {
    expect(dashboardKey('p-1', 'productivity', 30)).toEqual(['dashboard', 'scope', 'p-1', 'productivity', 30]);
  });
});
