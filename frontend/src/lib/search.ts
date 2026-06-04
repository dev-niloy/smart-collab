import { apiGet } from './api';
import { SearchResultSchema, type SearchResult } from './schemas/search';

type Args = { q: string; limit?: number };

export const searchAll = async ({ q, limit }: Args): Promise<SearchResult> => {
  const p = new URLSearchParams();
  p.set('q', q);
  if (limit !== undefined) p.set('limit', String(limit));
  const raw = await apiGet<unknown>(`/api/v1/search?${p.toString()}`);
  return SearchResultSchema.parse(raw);
};
