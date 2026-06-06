'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  me,
  login as apiLogin,
  signup as apiSignup,
  demoLogin as apiDemoLogin,
  logout as apiLogout,
  type PublicUser,
  type AuthResponse,
} from '@/lib/auth';
import type { LoginInput, SignupInput, Role } from '@/lib/schemas/auth';

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

const useAuthMutation = <Input>(fn: (input: Input) => Promise<AuthResponse>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      // Prime cache with the freshly authenticated user so Header re-renders
      // before the next router push, no extra /me roundtrip needed.
      qc.setQueryData(USER_KEY, data.user);
    },
  });
};

export const useLogin = () => useAuthMutation<LoginInput>(apiLogin);

export const useSignup = () => useAuthMutation<SignupInput>(apiSignup);

export const useDemoLogin = () => useAuthMutation<Role>(apiDemoLogin);

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiLogout,
    onSettled: async () => {
      qc.setQueryData(USER_KEY, null);
      await qc.invalidateQueries({ queryKey: USER_KEY });
    },
  });
};
