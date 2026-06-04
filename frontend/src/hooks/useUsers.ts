'use client';

import { useQuery } from '@tanstack/react-query';
import { listUsers } from '@/lib/users';
import type { TaskUser } from '@/lib/schemas/task';

export const USERS_KEY = ['users'] as const;

export const useUsers = () =>
  useQuery<TaskUser[]>({
    queryKey: USERS_KEY,
    queryFn: listUsers,
    staleTime: 60_000,
  });
