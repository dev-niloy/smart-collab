import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useActivity, useProjectActivity, activityKey } from '../useActivity';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sampleItem = (id: string) => ({
  id,
  action: 'task.created',
  actorId: 'u-1',
  actorName: 'Alice',
  entityType: 'task',
  entityId: 't-1',
  projectId: 'p-1',
  meta: null,
  createdAt: '2026-06-04T10:00:00.000Z',
});

const makeWrapper = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryProvider';
  return Wrapper;
};

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useActivity hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useActivity returns pages of items', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(200, { items: [sampleItem('a-1'), sampleItem('a-2')], nextCursor: 'CUR' }),
    );
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useActivity({ limit: 10 }), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].items.length).toBe(2);
  });

  it('useActivity advances via fetchNextPage', async () => {
    const sp = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(200, { items: [sampleItem('a-1')], nextCursor: 'CUR' }),
      )
      .mockResolvedValueOnce(
        mockResponse(200, { items: [sampleItem('a-2')], nextCursor: null }),
      );
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useActivity({ limit: 1 }), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => {
      expect(result.current.data?.pages.length).toBe(2);
    }, { timeout: 3000 });
    expect(result.current.data?.pages[1].items[0].id).toBe('a-2');
  });

  it('hasNextPage false when nextCursor is null', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(200, { items: [sampleItem('a-1')], nextCursor: null }),
    );
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useActivity(), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useProjectActivity scopes to projectId in URL', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(200, { items: [], nextCursor: null }),
    );
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useProjectActivity('proj-42'), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sp).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/proj-42/activity'),
      expect.anything(),
    );
  });

  it('activityKey distinguishes global vs project scopes', () => {
    expect(activityKey('global', 10)).not.toEqual(activityKey('p-1', 10));
  });

  it('respects limit override in URL', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [], nextCursor: null }));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useActivity({ limit: 5 }), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sp).toHaveBeenCalledWith(
      expect.stringContaining('limit=5'),
      expect.anything(),
    );
  });
});
