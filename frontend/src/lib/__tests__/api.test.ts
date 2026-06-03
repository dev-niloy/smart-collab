import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  apiGet,
  apiPost,
  apiDelete,
  ApiError,
  __resetRefreshState,
} from '../api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response => {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => text,
  } as unknown as Response;
};

describe('api fetch wrapper', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('apiGet parses 200 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { hello: 'world' })));
    const r = await apiGet<{ hello: string }>('/x');
    expect(r.hello).toBe('world');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/x'),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('apiPost sends JSON body and content-type', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(201, { ok: true }));
    vi.stubGlobal('fetch', fetchSpy);
    await apiPost('/x', { a: 1 });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('throws ApiError shape on 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(409, { error: { code: 'EMAIL_TAKEN', message: 'Already exists' } }, false),
      ),
    );
    await expect(apiGet('/x')).rejects.toBeInstanceOf(ApiError);
    await expect(apiGet('/x')).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'Already exists',
    });
  });

  it('apiDelete handles 204 no-content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(204)));
    const r = await apiDelete<void>('/x');
    expect(r).toBeUndefined();
  });

  it('on 401, calls refresh once, retries original on refresh-200', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      // first call -> 401
      .mockResolvedValueOnce(mockResponse(401, { error: { code: 'MISSING_TOKEN' } }, false))
      // refresh -> 200
      .mockResolvedValueOnce(mockResponse(200, { user: { id: 'u' } }))
      // retry -> 200
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await apiGet<{ ok: boolean }>('/me');
    expect(r.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[1][0]).toEqual(expect.stringContaining('/api/v1/auth/refresh'));
  });

  it('on 401 with failed refresh, throws and does NOT loop', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(mockResponse(401, { error: { code: 'MISSING_TOKEN' } }, false))
      .mockResolvedValueOnce(mockResponse(401, { error: { code: 'INVALID_REFRESH' } }, false));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(apiGet('/me')).rejects.toBeInstanceOf(ApiError);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT attempt refresh on auth endpoints (avoid loop)', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(mockResponse(401, { error: { code: 'INVALID_CREDENTIALS' } }, false));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(apiPost('/api/v1/auth/login', { email: 'x', password: 'y' })).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
