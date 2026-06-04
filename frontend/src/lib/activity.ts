import { apiGet } from './api';
import { ActivityPageSchema, type ActivityPage } from './schemas/activity';

type Args = { limit?: number; cursor?: string };

const buildQuery = (args?: Args): string => {
  const p = new URLSearchParams();
  if (args?.limit !== undefined) p.set('limit', String(args.limit));
  if (args?.cursor) p.set('cursor', args.cursor);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const listActivity = async (args?: Args): Promise<ActivityPage> => {
  const raw = await apiGet<unknown>(`/api/v1/activity${buildQuery(args)}`);
  return ActivityPageSchema.parse(raw);
};

export const listProjectActivity = async (
  projectId: string,
  args?: Args,
): Promise<ActivityPage> => {
  const raw = await apiGet<unknown>(`/api/v1/projects/${projectId}/activity${buildQuery(args)}`);
  return ActivityPageSchema.parse(raw);
};
