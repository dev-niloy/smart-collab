'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchUsers, type UserSearchHit } from '@/lib/users';

export const useUserSearch = (
  q: string,
  opts: { excludeProjectId?: string; enabled?: boolean; limit?: number } = {},
) => {
  const trimmed = q.trim();
  const enabled = (opts.enabled ?? true) && trimmed.length >= 1;
  return useQuery<UserSearchHit[]>({
    queryKey: ['users', 'search', trimmed, opts.excludeProjectId ?? null, opts.limit ?? 10] as const,
    queryFn: () =>
      searchUsers({ q: trimmed, excludeProjectId: opts.excludeProjectId, limit: opts.limit }),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
};
