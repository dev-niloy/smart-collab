import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listTasks,
  listTasksForProject,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from '../tasks';
import { __resetRefreshState } from '../api';

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

const sampleTask = {
  id: 't-1',
  projectId: 'p-1',
  title: 'Ship docs',
  description: null,
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: '2030-01-01T00:00:00.000Z',
  assignedTo: null,
  createdBy: 'u-1',
  creator: { id: 'u-1', email: 'a@x.y', name: 'Alice', role: 'admin' as const },
  assignee: null,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('lib/tasks client', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('listTasks: no params -> GET /api/v1/tasks without query', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { data: [sampleTask], total: 1, page: 1, limit: 10 }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await listTasks();
    expect(r.total).toBe(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/tasks$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listTasks: builds full query string', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { data: [], total: 0, page: 1, limit: 5 }));
    vi.stubGlobal('fetch', fetchSpy);
    await listTasks({
      projectId: 'p-1',
      q: 'ship it',
      status: 'todo',
      priority: 'high',
      assignedTo: 'unassigned',
      sort: 'dueDate',
      page: 2,
      limit: 5,
    });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('projectId=p-1');
    expect(url).toContain('q=ship+it');
    expect(url).toContain('status=todo');
    expect(url).toContain('priority=high');
    expect(url).toContain('assignedTo=unassigned');
    expect(url).toContain('sort=dueDate');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=5');
  });

  it('listTasksForProject hits nested route', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { data: [], total: 0, page: 1, limit: 10 }));
    vi.stubGlobal('fetch', fetchSpy);
    await listTasksForProject('p-7', { status: 'todo' });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/projects\/p-7\/tasks\?status=todo$/);
  });

  it('getTask: unwraps { task } -> task', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { task: sampleTask })));
    const t = await getTask('t-1');
    expect(t.id).toBe('t-1');
  });

  it('createTask: POSTs body with Date dueDate serialized to ISO', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(201, { task: sampleTask }));
    vi.stubGlobal('fetch', fetchSpy);
    const d = new Date('2030-06-01T00:00:00.000Z');
    await createTask({
      projectId: 'p-1',
      title: 'X',
      dueDate: d,
      status: 'todo',
      priority: 'medium',
    });
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.dueDate).toBe('2030-06-01T00:00:00.000Z');
    expect(body.projectId).toBe('p-1');
  });

  it('updateTask: PATCH, serializes Date dueDate if present', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { task: sampleTask }));
    vi.stubGlobal('fetch', fetchSpy);
    const d = new Date('2031-01-01T00:00:00.000Z');
    await updateTask('t-1', { title: 'New', dueDate: d });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/v1/tasks/t-1');
    expect((init as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.title).toBe('New');
    expect(body.dueDate).toBe('2031-01-01T00:00:00.000Z');
  });

  it('deleteTask: DELETE, resolves void on 204', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(204));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await deleteTask('t-1');
    expect(r).toBeUndefined();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/v1/tasks/t-1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('propagates ApiError on 422 DUPLICATE_TASK_TITLE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(
          422,
          { error: { code: 'DUPLICATE_TASK_TITLE', message: 'Task title already exists in this project.' } },
          false,
        ),
      ),
    );
    await expect(
      createTask({
        projectId: 'p-1',
        title: 'Dup',
        dueDate: new Date('2030-01-01'),
        status: 'todo',
        priority: 'medium',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'DUPLICATE_TASK_TITLE' });
  });
});
