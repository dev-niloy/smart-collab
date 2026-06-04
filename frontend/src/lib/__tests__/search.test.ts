import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchAll } from '../search';
import { __resetRefreshState } from '../api';
import { SearchResultSchema } from '../schemas/search';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sample = {
  projects: [
    {
      id: 'p-1',
      name: 'Alpha',
      description: null,
      status: 'active',
      deadline: '2026-06-30',
    },
  ],
  tasks: [
    {
      id: 't-1',
      title: 'fix it',
      description: null,
      projectId: 'p-1',
      projectName: 'Alpha',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-06-30',
    },
  ],
};

describe('lib/search client', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('SearchResultSchema validates expected shape', () => {
    const parsed = SearchResultSchema.parse(sample);
    expect(parsed.projects.length).toBe(1);
    expect(parsed.tasks.length).toBe(1);
  });

  it('searchAll passes q in query string', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, sample));
    vi.stubGlobal('fetch', sp);
    await searchAll({ q: 'foo' });
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/search\?q=foo$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('searchAll passes limit when supplied', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, sample));
    vi.stubGlobal('fetch', sp);
    await searchAll({ q: 'foo', limit: 3 });
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/search\?q=foo&limit=3$/),
      expect.anything(),
    );
  });

  it('returns parsed result', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, sample));
    vi.stubGlobal('fetch', sp);
    const out = await searchAll({ q: 'foo' });
    expect(out.projects[0].id).toBe('p-1');
    expect(out.tasks[0].id).toBe('t-1');
  });

  it('throws when shape invalid', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { bogus: true }));
    vi.stubGlobal('fetch', sp);
    await expect(searchAll({ q: 'foo' })).rejects.toThrow();
  });
});
