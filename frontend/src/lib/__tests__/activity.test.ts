import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listActivity, listProjectActivity } from '../activity';
import { __resetRefreshState } from '../api';
import { ActivityPageSchema } from '../schemas/activity';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const samplePage = {
  items: [
    {
      id: 'a-1',
      action: 'task.created',
      actorId: 'u-1',
      actorName: 'Alice',
      entityType: 'task',
      entityId: 't-1',
      projectId: 'p-1',
      meta: { title: 'Hello' },
      createdAt: '2026-06-04T10:00:00.000Z',
    },
  ],
  nextCursor: 'CURSOR',
};

describe('lib/activity client', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('ActivityPageSchema validates the expected shape', () => {
    const parsed = ActivityPageSchema.parse(samplePage);
    expect(parsed.items[0].action).toBe('task.created');
    expect(parsed.nextCursor).toBe('CURSOR');
  });

  it('listActivity hits /api/v1/activity with no params by default', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, samplePage));
    vi.stubGlobal('fetch', sp);
    const out = await listActivity();
    expect(out.items.length).toBe(1);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/activity$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listActivity passes limit and cursor query params', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, samplePage));
    vi.stubGlobal('fetch', sp);
    await listActivity({ limit: 5, cursor: 'xyz' });
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/activity\?limit=5&cursor=xyz$/),
      expect.anything(),
    );
  });

  it('listProjectActivity hits /api/v1/projects/:id/activity', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, samplePage));
    vi.stubGlobal('fetch', sp);
    await listProjectActivity('p-1', { limit: 10 });
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/activity\?limit=10$/),
      expect.anything(),
    );
  });

  it('returns parsed page', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, samplePage));
    vi.stubGlobal('fetch', sp);
    const out = await listActivity();
    expect(out.items[0].id).toBe('a-1');
    expect(out.nextCursor).toBe('CURSOR');
  });

  it('throws when response shape invalid', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { wrong: true }));
    vi.stubGlobal('fetch', sp);
    await expect(listActivity()).rejects.toThrow();
  });
});
