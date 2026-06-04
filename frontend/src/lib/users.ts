import { apiGet } from './api';
import type { TaskUser } from './schemas/task';

type UserListResponse = { data: TaskUser[] };

export const listUsers = () =>
  apiGet<UserListResponse>('/api/v1/users').then((r) => r.data);
