import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../projects';
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

const sampleProject = {
  id: 'p-1',
  name: 'Site',
  description: null,
  deadline: '2030-01-01T00:00:00.000Z',
  status: 'active' as const,
  createdBy: 'u-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('lib/projects client', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('listProjects: no params -> GET /api/v1/projects without query', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { data: [sampleProject], total: 1, page: 1, limit: 10 }));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await listProjects();
    expect(r.total).toBe(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listProjects: builds query string from params (encodes q)', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { data: [], total: 0, page: 2, limit: 5 }));
    vi.stubGlobal('fetch', fetchSpy);
    await listProjects({ q: 'hello world', status: 'active', sort: 'deadline', page: 2, limit: 5 });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain('q=hello+world');
    expect(url).toContain('status=active');
    expect(url).toContain('sort=deadline');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=5');
  });

  it('getProject: unwraps { project } -> project', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { project: sampleProject })));
    const p = await getProject('p-1');
    expect(p.id).toBe('p-1');
  });

  it('createProject: POSTs body with deadline as ISO string', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(201, { project: sampleProject }));
    vi.stubGlobal('fetch', fetchSpy);
    const d = new Date('2030-06-01T00:00:00.000Z');
    const p = await createProject({ name: 'X', deadline: d, status: 'active' });
    expect(p.id).toBe('p-1');
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.deadline).toBe('2030-06-01T00:00:00.000Z');
    expect(body.name).toBe('X');
    expect(body.status).toBe('active');
  });

  it('updateProject: PATCHes body, serializes Date deadline if present', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { project: sampleProject }));
    vi.stubGlobal('fetch', fetchSpy);
    const d = new Date('2031-01-01T00:00:00.000Z');
    await updateProject('p-1', { name: 'Renamed', deadline: d });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/v1/projects/p-1');
    expect((init as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.name).toBe('Renamed');
    expect(body.deadline).toBe('2031-01-01T00:00:00.000Z');
  });

  it('updateProject: omits deadline transform when not provided', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { project: sampleProject }));
    vi.stubGlobal('fetch', fetchSpy);
    await updateProject('p-1', { status: 'completed' });
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.status).toBe('completed');
    expect(body.deadline).toBeUndefined();
  });

  it('deleteProject: sends DELETE, resolves void on 204', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(204));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await deleteProject('p-1');
    expect(r).toBeUndefined();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/v1/projects/p-1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('propagates ApiError on past-deadline 422', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      mockResponse(
        422,
        { error: { code: 'PAST_DEADLINE', message: 'Please select a valid deadline.' } },
        false,
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await expect(
      createProject({ name: 'X', deadline: new Date('2000-01-01'), status: 'active' }),
    ).rejects.toMatchObject({ status: 422, code: 'PAST_DEADLINE' });
  });
});
