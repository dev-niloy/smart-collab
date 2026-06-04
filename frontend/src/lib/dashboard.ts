import { apiGet } from './api';
import type {
  Kpis,
  StatusCounts,
  PriorityCounts,
  ProductivityResponse,
  UpcomingPayload,
  HighPriorityResponse,
} from './schemas/dashboard';

const scopePrefix = (projectId?: string): string =>
  projectId ? `/api/v1/projects/${projectId}/dashboard` : '/api/v1/dashboard';

export const getKpis = (projectId?: string) =>
  apiGet<Kpis>(`${scopePrefix(projectId)}/kpis`);

export const getStatusCounts = (projectId?: string) =>
  apiGet<StatusCounts>(`${scopePrefix(projectId)}/status`);

export const getPriorityCounts = (projectId?: string) =>
  apiGet<PriorityCounts>(`${scopePrefix(projectId)}/priority`);

export const getProductivity = (projectId: string | undefined, days = 30) =>
  apiGet<ProductivityResponse>(`${scopePrefix(projectId)}/productivity?days=${days}`).then(
    (r) => r.data,
  );

export const getUpcoming = (projectId: string | undefined, days = 7) =>
  apiGet<UpcomingPayload>(`${scopePrefix(projectId)}/upcoming?days=${days}`);

export const getHighPriority = (projectId?: string) =>
  apiGet<HighPriorityResponse>(`${scopePrefix(projectId)}/high-priority`).then((r) => r.data);
