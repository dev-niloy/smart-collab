'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
} from '@/lib/comments';
import type { CommentPage } from '@/lib/schemas/comment';

export const commentsKey = (taskId: string, limit: number) =>
  ['comments', taskId, limit] as const;

const STALE = 15_000;

export const useComments = (taskId: string, opts: { limit?: number } = {}) => {
  const limit = opts.limit ?? 20;
  return useInfiniteQuery<CommentPage>({
    queryKey: commentsKey(taskId, limit),
    queryFn: ({ pageParam }) => listComments(taskId, { limit, cursor: pageParam as string | undefined }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!taskId,
    staleTime: STALE,
  });
};

export const useCreateComment = (taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createComment(taskId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
};

export const useUpdateComment = (taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => updateComment(taskId, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
};

export const useDeleteComment = (taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteComment(taskId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
};
