'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { listActivity, listProjectActivity } from '@/lib/activity';
import type { ActivityPage } from '@/lib/schemas/activity';

export const activityKey = (scope: 'global' | string, limit: number) =>
  scope === 'global'
    ? (['activity', 'global', limit] as const)
    : (['activity', 'project', scope, limit] as const);

const STALE = 15_000;

export const useActivity = (opts: { limit?: number } = {}) => {
  const limit = opts.limit ?? 10;
  return useInfiniteQuery<ActivityPage>({
    queryKey: activityKey('global', limit),
    queryFn: ({ pageParam }) =>
      listActivity({ limit, cursor: pageParam as string | undefined }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE,
  });
};

export const useProjectActivity = (
  projectId: string,
  opts: { limit?: number } = {},
) => {
  const limit = opts.limit ?? 10;
  return useInfiniteQuery<ActivityPage>({
    queryKey: activityKey(projectId, limit),
    queryFn: ({ pageParam }) =>
      listProjectActivity(projectId, { limit, cursor: pageParam as string | undefined }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!projectId,
    staleTime: STALE,
  });
};

// Composite hook for the dashboard grid: keeps the conditional-scope choice
// out of components. Both underlying hooks are still mounted (React rules of
// hooks), but only the enabled one actually fetches.
export const useScopedActivity = (
  projectId: string | undefined,
  opts: { limit?: number } = {},
) => {
  const global = useActivity(opts);
  const scoped = useProjectActivity(projectId ?? '', opts);
  return projectId ? scoped : global;
};
