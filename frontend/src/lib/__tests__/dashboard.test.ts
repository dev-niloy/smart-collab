import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getKpis,
  getStatusCounts,
  getPriorityCounts,
  getProductivity,
  getUpcoming,
  getHighPriority,
} from '../dashboard';
import { __resetRefreshState, ApiError } from '../api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

describe('lib/dashboard client', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('getKpis global hits /api/v1/dashboard/kpis', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(200, {
        totalProjects: 1,
        totalTasks: 2,
        completedTasks: 1,
        completionPct: 50,
        myOpenTasks: 1,
      }),
    );
    vi.stubGlobal('fetch', sp);
    const out = await getKpis();
    expect(out.totalProjects).toBe(1);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/dashboard\/kpis$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getKpis scoped hits /api/v1/projects/:id/dashboard/kpis', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(200, { totalProjects: 1, totalTasks: 0, completedTasks: 0, completionPct: 0, myOpenTasks: 0 }),
    );
    vi.stubGlobal('fetch', sp);
    await getKpis('p-1');
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/dashboard\/kpis$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getStatusCounts global path', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { todo: 1, in_progress: 0, completed: 0 }));
    vi.stubGlobal('fetch', sp);
    const out = await getStatusCounts();
    expect(out.todo).toBe(1);
    expect(sp).toHaveBeenCalledWith(expect.stringMatching(/\/dashboard\/status$/), expect.anything());
  });

  it('getPriorityCounts scoped path', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { low: 0, medium: 0, high: 2 }));
    vi.stubGlobal('fetch', sp);
    const out = await getPriorityCounts('p-1');
    expect(out.high).toBe(2);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/dashboard\/priority$/),
      expect.anything(),
    );
  });

  it('getProductivity passes days query param and unwraps data', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(200, { data: [{ date: '2026-06-04', completed: 0 }] }),
    );
    vi.stubGlobal('fetch', sp);
    const out = await getProductivity(undefined, 14);
    expect(out).toHaveLength(1);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/dashboard\/productivity\?days=14$/),
      expect.anything(),
    );
  });

  it('getUpcoming returns {tasks, projects}', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { tasks: [], projects: [] }));
    vi.stubGlobal('fetch', sp);
    const out = await getUpcoming(undefined, 7);
    expect(out.tasks).toEqual([]);
    expect(out.projects).toEqual([]);
  });

  it('getHighPriority unwraps data', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { data: [] }));
    vi.stubGlobal('fetch', sp);
    const out = await getHighPriority();
    expect(out).toEqual([]);
  });

  it('getKpis 401 surfaces ApiError', async () => {
    const sp = vi
      .fn()
      .mockResolvedValue(mockResponse(401, { error: { code: 'MISSING_TOKEN', message: 'no' } }, false));
    vi.stubGlobal('fetch', sp);
    await expect(getKpis()).rejects.toBeInstanceOf(ApiError);
  });
});
