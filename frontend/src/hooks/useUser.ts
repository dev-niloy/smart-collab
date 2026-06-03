'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { me, logout as apiLogout, type PublicUser } from '@/lib/auth';
import type { Role } from '@/lib/schemas/auth';

const USER_KEY = ['auth', 'me'] as const;

export const useUser = () => {
  const q = useQuery<PublicUser | null>({
    queryKey: USER_KEY,
    queryFn: async () => {
      try {
        const r = await me();
        return r.user;
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
  });
  return { user: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
};

export const useRole = (): { role: Role | null; isLoading: boolean } => {
  const { user, isLoading } = useUser();
  return { role: user?.role ?? null, isLoading };
};

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiLogout,
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: USER_KEY });
      qc.setQueryData(USER_KEY, null);
    },
  });
};
