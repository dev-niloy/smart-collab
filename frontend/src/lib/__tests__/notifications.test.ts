import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../notifications';
import { __resetRefreshState } from '../api';

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

describe('lib/notifications', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('listNotifications passes unread + cursor + limit', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [sample], nextCursor: 'X' }));
    vi.stubGlobal('fetch', sp);
    const page = await listNotifications({ limit: 5, cursor: 'C', unread: true });
    expect(page.nextCursor).toBe('X');
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/notifications\?limit=5&cursor=C&unread=true$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getUnreadCount returns {count}', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { count: 7 }));
    vi.stubGlobal('fetch', sp);
    const r = await getUnreadCount();
    expect(r.count).toBe(7);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/notifications\/unread-count$/),
      expect.anything(),
    );
  });

  it('markNotificationRead POSTs and returns DTO', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { notification: { ...sample, readAt: '2026-06-04T10:01:00.000Z' } }));
    vi.stubGlobal('fetch', sp);
    const dto = await markNotificationRead('n1');
    expect(dto.readAt).toBeTruthy();
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/notifications\/n1\/read$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('markAllNotificationsRead returns {updated}', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { updated: 4 }));
    vi.stubGlobal('fetch', sp);
    const r = await markAllNotificationsRead();
    expect(r.updated).toBe(4);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/notifications\/read-all$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
