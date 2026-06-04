import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUsers, USERS_KEY } from '../useUsers';
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

describe('useUsers', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('fetches and exposes user list', async () => {
    const users = [
      { id: 'u-1', email: 'a@x.y', name: 'Alice', role: 'admin' },
      { id: 'u-2', email: 'b@x.y', name: 'Bob', role: 'team_member' },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { data: users })));
    const qc = makeClient();
    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(qc.getQueryData(USERS_KEY)).toHaveLength(2);
  });

  it('exposes error state when 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(401, { error: { code: 'MISSING_TOKEN', message: 'Missing access token' } }, false),
      ),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { code?: string })?.code).toBe('MISSING_TOKEN');
  });
});
