import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listComments, createComment, updateComment, deleteComment } from '../comments';
import { __resetRefreshState } from '../api';

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

describe('lib/comments', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('listComments passes taskId + query params', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [sampleDTO], nextCursor: null }));
    vi.stubGlobal('fetch', sp);
    const page = await listComments('t1', { limit: 10, cursor: 'abc' });
    expect(page.items.length).toBe(1);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/tasks\/t1\/comments\?limit=10&cursor=abc$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('createComment POSTs body and returns DTO', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(201, { comment: sampleDTO }));
    vi.stubGlobal('fetch', sp);
    const dto = await createComment('t1', 'hi');
    expect(dto.id).toBe('c1');
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/tasks\/t1\/comments$/),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: 'hi' }) }),
    );
  });

  it('updateComment PATCHes body', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { comment: sampleDTO }));
    vi.stubGlobal('fetch', sp);
    await updateComment('t1', 'c1', 'edited');
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/tasks\/t1\/comments\/c1$/),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ body: 'edited' }) }),
    );
  });

  it('deleteComment fires DELETE', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(204));
    vi.stubGlobal('fetch', sp);
    await deleteComment('t1', 'c1');
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/tasks\/t1\/comments\/c1$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
