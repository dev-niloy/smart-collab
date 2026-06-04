import { z } from 'zod';

const uuidString = z.string().uuid();

export const taskScopedParamsSchema = z.object({ taskId: uuidString });
export const attachmentIdParamSchema = z.object({ taskId: uuidString, id: uuidString });
export const attachmentDownloadParamSchema = z.object({ id: uuidString });
