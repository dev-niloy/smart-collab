import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useProjectMembers,
  useAssignableMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
  projectMembersKey,
  assignableMembersKey,
} from '../useProjectMembers';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sampleMember = {
  id: 'm-1',
  projectId: 'p-1',
  userId: 'u-1',
  role: 'member' as const,
  addedAt: '2026-06-04T00:00:00.000Z',
  addedById: 'u-actor',
  user: { id: 'u-1', email: 'a@x.y', name: 'Alice', role: 'team_member' as const },
  workload: { todo: 0, in_progress: 0, completed: 0, due_soon: 0 },
};

const makeWrapper = (qc: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryProvider';
  return Wrapper;
};

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe('useProjectMembers hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useProjectMembers is disabled when no projectId', () => {
    const qc = makeClient();
    const { result } = renderHook(() => useProjectMembers(undefined), { wrapper: makeWrapper(qc) });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useProjectMembers fetches when projectId provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { data: [sampleMember] })));
    const qc = makeClient();
    const { result } = renderHook(() => useProjectMembers('p-1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe('m-1');
  });

  it('useAssignableMembers fetches /assignable subpath', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          data: [{ id: 'u-1', email: 'a@x.y', name: 'A', role: 'team_member', projectRole: 'member' }],
        }),
      ),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useAssignableMembers('p-1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].projectRole).toBe('member');
  });

  it('useAddMember invalidates members on success', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse(201, { member: sampleMember }));
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    qc.setQueryData(projectMembersKey('p-1'), [{ ...sampleMember, id: 'old' }]);
    const { result } = renderHook(() => useAddMember('p-1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ email: 'a@x.y', role: 'member' });
    });
    const state = qc.getQueryState(projectMembersKey('p-1'));
    expect(state?.isInvalidated).toBe(true);
  });

  it('useUpdateMemberRole invalidates members on success', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      mockResponse(200, { member: { ...sampleMember, role: 'pm' } }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    qc.setQueryData(projectMembersKey('p-1'), [sampleMember]);
    const { result } = renderHook(() => useUpdateMemberRole('p-1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ memberId: 'm-1', input: { role: 'pm' } });
    });
    expect(qc.getQueryState(projectMembersKey('p-1'))?.isInvalidated).toBe(true);
  });

  it('useRemoveMember invalidates members AND tasks', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      mockResponse(200, { removedMemberId: 'm-1', tasksUnassigned: 2 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    qc.setQueryData(projectMembersKey('p-1'), [sampleMember]);
    qc.setQueryData(['tasks'], { data: [], total: 0, page: 1, limit: 10 });
    const { result } = renderHook(() => useRemoveMember('p-1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      const out = await result.current.mutateAsync('m-1');
      expect(out.tasksUnassigned).toBe(2);
    });
    expect(qc.getQueryState(projectMembersKey('p-1'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['tasks'])?.isInvalidated).toBe(true);
  });

  it('useAddMember surfaces ALREADY_MEMBER ApiError', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        mockResponse(422, { error: { code: 'ALREADY_MEMBER', message: 'dup' } }, false),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const qc = makeClient();
    const { result } = renderHook(() => useAddMember('p-1'), { wrapper: makeWrapper(qc) });
    await expect(
      result.current.mutateAsync({ email: 'a@x.y', role: 'member' }),
    ).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
  });

  it('useProjectMembers surfaces 401 as error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(401, { error: { code: 'MISSING_TOKEN', message: 'no' } }, false),
      ),
    );
    const qc = makeClient();
    const { result } = renderHook(() => useProjectMembers('p-1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('query keys snapshot', () => {
    expect(projectMembersKey('p-1')).toEqual(['project-members', 'p-1']);
    expect(assignableMembersKey('p-1')).toEqual(['project-members', 'p-1', 'assignable']);
  });
});
