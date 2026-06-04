'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAttachments, uploadAttachment, deleteAttachment } from '@/lib/attachments';
import type { AttachmentList } from '@/lib/schemas/attachment';

export const attachmentsKey = (taskId: string) => ['attachments', taskId] as const;

export const useAttachments = (taskId: string) =>
  useQuery<AttachmentList>({
    queryKey: attachmentsKey(taskId),
    queryFn: () => listAttachments(taskId),
    enabled: !!taskId,
    staleTime: 15_000,
  });

export const useUploadAttachment = (taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(taskId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentsKey(taskId) }),
  });
};

export const useDeleteAttachment = (taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAttachment(taskId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentsKey(taskId) }),
  });
};
