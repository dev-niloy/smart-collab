import { apiGet } from './api';
import type { TaskUser } from './schemas/task';

type UserListResponse = { data: TaskUser[] };

export const listUsers = () =>
  apiGet<UserListResponse>('/api/v1/users').then((r) => r.data);

export type UserSearchHit = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

type UserSearchResponse = { data: UserSearchHit[] };

export const searchUsers = (params: {
  q: string;
  excludeProjectId?: string;
  limit?: number;
}): Promise<UserSearchHit[]> => {
  const usp = new URLSearchParams();
  usp.set('q', params.q);
  if (params.excludeProjectId) usp.set('excludeProjectId', params.excludeProjectId);
  if (params.limit !== undefined) usp.set('limit', String(params.limit));
  return apiGet<UserSearchResponse>(`/api/v1/users/search?${usp.toString()}`).then(
    (r) => r.data,
  );
};
