'use client';

import { useQuery } from '@tanstack/react-query';
import { searchAll } from '@/lib/search';
import type { SearchResult } from '@/lib/schemas/search';

const STALE = 15_000;

export const searchKey = (q: string, limit: number) =>
  ['search', q, limit] as const;

export const useGlobalSearch = (q: string, limit = 5) => {
  const enabled = q.trim().length >= 2;
  return useQuery<SearchResult>({
    queryKey: searchKey(q, limit),
    queryFn: () => searchAll({ q, limit }),
    enabled,
    staleTime: STALE,
  });
};
