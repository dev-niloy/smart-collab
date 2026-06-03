import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  PROJECTS_KEY,
  projectKey,
} from '../useProjects';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sampleProject = {
  id: 'p-1',
  name: 'Site',
  description: null,
  deadline: '2030-01-01T00:00:00.000Z',
  status: 'active' as const,
  createdBy: 'u-1',
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

describe('useProjects hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useProjects fetches list with params', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(200, { data: [sampleProject], total: 1, page: 1, limit: 10 })),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useProjects({ status: 'active', sort: 'deadline' }), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(1);
  });

  it('useProject is disabled when id is undefined', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    const { result } = renderHook(() => useProject(undefined), { wrapper: makeWrapper(qc) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('useProject fetches when id present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { project: sampleProject })));
    const qc = makeClient();
    const { result } = renderHook(() => useProject('p-1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('p-1');
  });

  it('useCreateProject primes detail cache + invalidates list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(201, { project: sampleProject })));
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateProject(), { wrapper: makeWrapper(qc) });
    await result.current.mutateAsync({
      name: 'Site',
      deadline: new Date('2030-01-01'),
      status: 'active',
    });
    expect(qc.getQueryData(projectKey('p-1'))).toMatchObject({ id: 'p-1' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PROJECTS_KEY });
  });

  it('useUpdateProject primes detail cache + invalidates list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { project: sampleProject })));
    const qc = makeClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateProject('p-1'), { wrapper: makeWrapper(qc) });
    await result.current.mutateAsync({ name: 'New' });
    expect(qc.getQueryData(projectKey('p-1'))).toMatchObject({ id: 'p-1' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PROJECTS_KEY });
  });

  it('useDeleteProject removes detail cache + invalidates list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(204)));
    const qc = makeClient();
    qc.setQueryData(projectKey('p-1'), sampleProject);
    const removeSpy = vi.spyOn(qc, 'removeQueries');
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteProject(), { wrapper: makeWrapper(qc) });
    await result.current.mutateAsync('p-1');
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: projectKey('p-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PROJECTS_KEY });
  });

  it('useCreateProject propagates ApiError on 422 PAST_DEADLINE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(
          422,
          { error: { code: 'PAST_DEADLINE', message: 'Please select a valid deadline.' } },
          false,
        ),
      ),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useCreateProject(), { wrapper: makeWrapper(qc) });
    await expect(
      result.current.mutateAsync({
        name: 'X',
        deadline: new Date('2000-01-01'),
        status: 'active',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'PAST_DEADLINE' });
  });
});
