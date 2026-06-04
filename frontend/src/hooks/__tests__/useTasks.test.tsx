import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useTasks,
  useProjectTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  TASKS_KEY,
  taskKey,
} from '../useTasks';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sampleTask = {
  id: 't-1',
  projectId: 'p-1',
  title: 'Ship docs',
  description: null,
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: '2030-01-01T00:00:00.000Z',
  assignedTo: null,
  createdBy: 'u-1',
  creator: { id: 'u-1', email: 'a@x.y', name: 'Alice', role: 'admin' as const },
  assignee: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const makeWrapper = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryProvider';
  return Wrapper;
};

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe('useTasks hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useTasks fetches list with params', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(mockResponse(200, { data: [sampleTask], total: 1, page: 1, limit: 10 })),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useTasks({ projectId: 'p-1', status: 'todo' }), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(1);
  });

  it('useProjectTasks idle when projectId undefined', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    const { result } = renderHook(() => useProjectTasks(undefined), { wrapper: makeWrapper(qc) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('useProjectTasks hits nested route when id present', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { data: [sampleTask], total: 1, page: 1, limit: 10 }));
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    const { result } = renderHook(() => useProjectTasks('p-7'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/projects\/p-7\/tasks/);
  });

  it('useTask disabled when id undefined', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    const { result } = renderHook(() => useTask(undefined), { wrapper: makeWrapper(qc) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('useTask fetches when id present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { task: sampleTask })));
    const qc = makeClient();
    const { result } = renderHook(() => useTask('t-1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('t-1');
  });

  it('useCreateTask primes detail cache + invalidates list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(201, { task: sampleTask })));
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTask(), { wrapper: makeWrapper(qc) });
    await result.current.mutateAsync({
      projectId: 'p-1',
      title: 'X',
      dueDate: new Date('2030-01-01'),
      status: 'todo',
      priority: 'medium',
    });
    expect(qc.getQueryData(taskKey('t-1'))).toMatchObject({ id: 't-1' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TASKS_KEY });
  });

  it('useUpdateTask primes detail cache + invalidates list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { task: sampleTask })));
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateTask('t-1'), { wrapper: makeWrapper(qc) });
    await result.current.mutateAsync({ status: 'in_progress' });
    expect(qc.getQueryData(taskKey('t-1'))).toMatchObject({ id: 't-1' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TASKS_KEY });
  });

  it('useDeleteTask removes detail cache + invalidates list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(204)));
    const qc = makeClient();
    qc.setQueryData(taskKey('t-1'), sampleTask);
    const removeSpy = vi.spyOn(qc, 'removeQueries');
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteTask(), { wrapper: makeWrapper(qc) });
    await result.current.mutateAsync('t-1');
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: taskKey('t-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TASKS_KEY });
  });

  it('useCreateTask propagates ApiError on 422 DUPLICATE_TASK_TITLE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(
          422,
          { error: { code: 'DUPLICATE_TASK_TITLE', message: 'Task title already exists in this project.' } },
          false,
        ),
      ),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useCreateTask(), { wrapper: makeWrapper(qc) });
    await expect(
      result.current.mutateAsync({
        projectId: 'p-1',
        title: 'Dup',
        dueDate: new Date('2030-01-01'),
        status: 'todo',
        priority: 'medium',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'DUPLICATE_TASK_TITLE' });
  });
});
