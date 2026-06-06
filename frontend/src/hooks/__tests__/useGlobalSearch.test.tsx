import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGlobalSearch, searchKey } from '../useGlobalSearch';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const empty = { projects: [], tasks: [] };

const makeWrapper = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryProvider';
  return Wrapper;
};

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useGlobalSearch', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('disabled when q.length < 2', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, empty));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useGlobalSearch('a'), {
      wrapper: makeWrapper(makeClient()),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.isPending).toBe(true);
    expect(sp).not.toHaveBeenCalled();
  });

  it('fetches when q.length >= 2', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, empty));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useGlobalSearch('foo'), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sp).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/search?q=foo'),
      expect.anything(),
    );
  });

  it('searchKey changes with q and limit', () => {
    expect(searchKey('foo', 5)).not.toEqual(searchKey('foo', 10));
    expect(searchKey('foo', 5)).not.toEqual(searchKey('bar', 5));
  });

  it('limit override flows through to query', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, empty));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useGlobalSearch('foo', 3), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sp).toHaveBeenCalledWith(
      expect.stringContaining('limit=3'),
      expect.anything(),
    );
  });
});
