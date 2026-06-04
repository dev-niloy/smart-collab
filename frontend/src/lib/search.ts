import { apiGet } from './api';
import { SearchResultSchema, type SearchResult } from './schemas/search';

type Args = { q: string; limit?: number };

// Mirrored from backend search.constant. Kept inline (rather than imported
// across the workspace boundary) so the client can fail-fast without a
// round-trip when q is too short.
export const MIN_Q = 2;
export const MAX_Q = 200;
export const MAX_HIT_LIMIT = 20;

export const searchAll = async ({ q, limit }: Args): Promise<SearchResult> => {
  const trimmed = q.trim();
  if (trimmed.length < MIN_Q) {
    throw new Error(`Search query must be at least ${MIN_Q} characters`);
  }
  if (trimmed.length > MAX_Q) {
    throw new Error(`Search query must be at most ${MAX_Q} characters`);
  }
  if (limit !== undefined && (limit < 1 || limit > MAX_HIT_LIMIT)) {
    throw new Error(`Search limit must be between 1 and ${MAX_HIT_LIMIT}`);
  }
  const p = new URLSearchParams();
  p.set('q', trimmed);
  if (limit !== undefined) p.set('limit', String(limit));
  const raw = await apiGet<unknown>(`/api/v1/search?${p.toString()}`);
  return SearchResultSchema.parse(raw);
};
