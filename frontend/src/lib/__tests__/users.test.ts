import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listUsers } from '../users';
import { __resetRefreshState } from '../api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

describe('lib/users client', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('listUsers: GET /api/v1/users -> unwraps { data } -> array', async () => {
    const users = [
      { id: 'u-1', email: 'a@x.y', name: 'Alice', role: 'admin' },
      { id: 'u-2', email: 'b@x.y', name: 'Bob', role: 'team_member' },
    ];
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(200, { data: users }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await listUsers();
    expect(r).toHaveLength(2);
    expect(r[0].email).toBe('a@x.y');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/users'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('propagates 401 ApiError when unauth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(401, { error: { code: 'MISSING_TOKEN', message: 'Missing access token' } }, false),
      ),
    );
    await expect(listUsers()).rejects.toMatchObject({ status: 401, code: 'MISSING_TOKEN' });
  });
});
