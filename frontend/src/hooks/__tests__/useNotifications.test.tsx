import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../useNotifications';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sample = {
  id: 'n1',
  type: 'task.assigned',
  actorId: 'u1',
  actorName: 'Alice',
  entityType: 'task',
  entityId: 't1',
  projectId: 'p1',
  payload: { taskTitle: 'hi' },
  readAt: null,
  createdAt: '2026-06-04T10:00:00.000Z',
};

const makeWrapper = (qc: QueryClient) => {
  const W = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  W.displayName = 'QC';
  return W;
};
const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });

describe('useNotifications hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useNotifications fetches page and respects unread flag in URL', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [sample], nextCursor: null }));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useNotifications({ limit: 10, unread: true }), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sp).toHaveBeenCalledWith(
      expect.stringContaining('unread=true'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('useUnreadCount returns count', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { count: 4 }));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useUnreadCount(), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(4);
  });

  it('useMarkNotificationRead invalidates notifications + count', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { notification: { ...sample, readAt: '2026-06-04T10:01:00.000Z' } }));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('n1');
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('useMarkAllNotificationsRead returns {updated} and invalidates', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { updated: 5 }));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper: makeWrapper(qc) });
    await act(async () => {
      const r = await result.current.mutateAsync();
      expect(r.updated).toBe(5);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });
});
