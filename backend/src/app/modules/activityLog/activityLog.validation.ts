import { z } from 'zod';
import { DEFAULT_ACTIVITY_LIMIT, MAX_ACTIVITY_LIMIT } from './activityLog.constant';

export const listQuerySchema = z.object({
  limit: z
    .preprocess(
      (v) => (v === undefined ? undefined : Number(v)),
      z.number().int().min(1).max(MAX_ACTIVITY_LIMIT),
    )
    .default(DEFAULT_ACTIVITY_LIMIT),
  cursor: z.string().optional(),
});

export type ListActivityQuery = z.infer<typeof listQuerySchema>;

export type CursorPayload = {
  createdAt: Date;
  id: string;
};

export function encodeCursor(p: CursorPayload): string {
  const json = JSON.stringify({ createdAt: p.createdAt.toISOString(), id: p.id });
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  let raw: string;
  try {
    raw = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new Error('Invalid cursor');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid cursor');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).createdAt !== 'string' ||
    typeof (parsed as Record<string, unknown>).id !== 'string'
  ) {
    throw new Error('Invalid cursor');
  }
  const { createdAt, id } = parsed as { createdAt: string; id: string };
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid cursor');
  }
  return { createdAt: d, id };
}
