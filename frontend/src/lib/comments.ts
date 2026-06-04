import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import {
  CommentDTOSchema,
  CommentPageSchema,
  type CommentDTO,
  type CommentPage,
} from './schemas/comment';

type ListArgs = { limit?: number; cursor?: string };

const buildQuery = (args?: ListArgs): string => {
  const p = new URLSearchParams();
  if (args?.limit !== undefined) p.set('limit', String(args.limit));
  if (args?.cursor) p.set('cursor', args.cursor);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const listComments = async (taskId: string, args?: ListArgs): Promise<CommentPage> => {
  const raw = await apiGet<unknown>(`/api/v1/tasks/${taskId}/comments${buildQuery(args)}`);
  return CommentPageSchema.parse(raw);
};

export const createComment = async (taskId: string, body: string): Promise<CommentDTO> => {
  const raw = await apiPost<{ comment: unknown }>(`/api/v1/tasks/${taskId}/comments`, { body });
  return CommentDTOSchema.parse(raw.comment);
};

export const updateComment = async (
  taskId: string,
  id: string,
  body: string,
): Promise<CommentDTO> => {
  const raw = await apiPatch<{ comment: unknown }>(`/api/v1/tasks/${taskId}/comments/${id}`, { body });
  return CommentDTOSchema.parse(raw.comment);
};

export const deleteComment = async (taskId: string, id: string): Promise<void> => {
  await apiDelete(`/api/v1/tasks/${taskId}/comments/${id}`);
};
