import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from '../useComments';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sampleDTO = {
  id: 'c1',
  taskId: 't1',
  body: 'hi',
  author: { id: 'u1', name: 'Alice' },
  createdAt: '2026-06-04T10:00:00.000Z',
  updatedAt: '2026-06-04T10:00:00.000Z',
};

const makeWrapper = (qc: QueryClient) => {
  const W = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  W.displayName = 'QC';
  return W;
};

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useComments hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useComments fetches first page', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [sampleDTO], nextCursor: null }));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useComments('t1'), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].items[0].id).toBe('c1');
  });

  it('useCreateComment posts and invalidates comments query', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(201, { comment: sampleDTO }));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateComment('t1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('hi');
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['comments', 't1'] });
  });

  it('useUpdateComment patches and invalidates', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { comment: sampleDTO }));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateComment('t1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', body: 'edited' });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['comments', 't1'] });
  });

  it('useDeleteComment deletes and invalidates', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(204));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteComment('t1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('c1');
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['comments', 't1'] });
  });
});
