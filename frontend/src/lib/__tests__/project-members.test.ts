import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listProjectMembers,
  listAssignableMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '../project-members';
import { __resetRefreshState, ApiError } from '../api';

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

const sampleMember = {
  id: 'm-1',
  projectId: 'p-1',
  userId: 'u-1',
  role: 'member' as const,
  addedAt: '2026-06-04T00:00:00.000Z',
  addedById: 'u-actor',
  user: {
    id: 'u-1',
    email: 'a@x.y',
    name: 'Alice',
    role: 'team_member' as const,
  },
  workload: { todo: 0, in_progress: 0, completed: 0, due_soon: 0 },
};

describe('lib/project-members client', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('listProjectMembers: GETs /api/v1/projects/:id/members and unwraps data', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(200, { data: [sampleMember] }));
    vi.stubGlobal('fetch', fetchSpy);
    const out = await listProjectMembers('p-1');
    expect(out).toEqual([sampleMember]);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/members$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listAssignableMembers: GETs /assignable subpath', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      mockResponse(200, {
        data: [
          { id: 'u-1', email: 'a@x.y', name: 'A', role: 'team_member', projectRole: 'member' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const out = await listAssignableMembers('p-1');
    expect(out).toHaveLength(1);
    expect(out[0].projectRole).toBe('member');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/members\/assignable$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('addProjectMember: POSTs body and unwraps {member}', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(201, { member: sampleMember }));
    vi.stubGlobal('fetch', fetchSpy);
    const out = await addProjectMember('p-1', { email: 'a@x.y', role: 'member' });
    expect(out.id).toBe('m-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/members$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@x.y', role: 'member' }),
      }),
    );
  });

  it('addProjectMember: ApiError 422 ALREADY_MEMBER surfaces', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        mockResponse(422, { error: { code: 'ALREADY_MEMBER', message: 'dup' } }, false),
      );
    vi.stubGlobal('fetch', fetchSpy);
    await expect(
      addProjectMember('p-1', { email: 'a@x.y', role: 'member' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('addProjectMember: ApiError 404 USER_NOT_FOUND surfaces', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        mockResponse(404, { error: { code: 'USER_NOT_FOUND', message: 'no user' } }, false),
      );
    vi.stubGlobal('fetch', fetchSpy);
    await expect(addProjectMember('p-1', { email: 'a@x.y', role: 'member' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  it('updateProjectMemberRole: PATCHes role and unwraps {member}', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { member: { ...sampleMember, role: 'pm' } }));
    vi.stubGlobal('fetch', fetchSpy);
    const out = await updateProjectMemberRole('p-1', 'm-1', { role: 'pm' });
    expect(out.role).toBe('pm');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/members\/m-1$/),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'pm' }) }),
    );
  });

  it('removeProjectMember: DELETE returns body', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, { removedMemberId: 'm-1', tasksUnassigned: 2 }));
    vi.stubGlobal('fetch', fetchSpy);
    const out = await removeProjectMember('p-1', 'm-1');
    expect(out.tasksUnassigned).toBe(2);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/p-1\/members\/m-1$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('removeProjectMember: 422 CANNOT_REMOVE_LAST_PM surfaces', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        mockResponse(422, { error: { code: 'CANNOT_REMOVE_LAST_PM', message: 'last pm' } }, false),
      );
    vi.stubGlobal('fetch', fetchSpy);
    await expect(removeProjectMember('p-1', 'm-1')).rejects.toMatchObject({
      code: 'CANNOT_REMOVE_LAST_PM',
    });
  });

  it('listProjectMembers: 401 surfaces as ApiError', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(401, { error: { code: 'MISSING_TOKEN', message: 'no' } }, false));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(listProjectMembers('p-1')).rejects.toBeInstanceOf(ApiError);
  });
});
