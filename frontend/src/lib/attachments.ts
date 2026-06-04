import { apiGet, apiDelete, ApiError } from './api';
import {
  AttachmentDTOSchema,
  AttachmentListSchema,
  type AttachmentDTO,
  type AttachmentList,
} from './schemas/attachment';

const apiBase = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  return raw ? raw.replace(/\/$/, '') : 'http://localhost:4000';
};

export const listAttachments = async (taskId: string): Promise<AttachmentList> => {
  const raw = await apiGet<unknown>(`/api/v1/tasks/${taskId}/attachments`);
  return AttachmentListSchema.parse(raw);
};

export const uploadAttachment = async (taskId: string, file: File): Promise<AttachmentDTO> => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${apiBase()}/api/v1/tasks/${taskId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  if (!res.ok) {
    let message = res.statusText || 'Upload failed';
    let code = `HTTP_${res.status}`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body.error?.message) message = body.error.message;
      if (body.error?.code) code = body.error.code;
    } catch {
      // ignore non-json
    }
    throw new ApiError({ status: res.status, code, message });
  }
  const body = (await res.json()) as { attachment: unknown };
  return AttachmentDTOSchema.parse(body.attachment);
};

export const deleteAttachment = async (taskId: string, id: string): Promise<void> => {
  await apiDelete(`/api/v1/tasks/${taskId}/attachments/${id}`);
};

export const attachmentDownloadUrl = (id: string): string =>
  `${apiBase()}/api/v1/attachments/file/${id}`;
