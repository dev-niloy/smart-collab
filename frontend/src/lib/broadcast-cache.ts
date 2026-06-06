/**
 * Cross-tab react-query invalidation transport.
 *
 * Same-origin tabs share a `BroadcastChannel` named `smart-collab-cache`.
 * When one tab invalidates a query, the channel posts `{ queryKey }` so peer
 * tabs replay the invalidation on their own `QueryClient`. This closes the
 * #B4(b) gap where Tab A added a member and Tab B's assignee dropdown stayed
 * stale because `refetchOnWindowFocus: false` is set globally.
 */

export const CACHE_CHANNEL_NAME = 'smart-collab-cache';

export type CacheMessage = {
  type: 'invalidate';
  queryKey: readonly unknown[];
  senderId: string;
};

export const serializeKey = (key: readonly unknown[]): string => {
  try {
    return JSON.stringify(key);
  } catch {
    return String(key);
  }
};

export const isBroadcastChannelSupported = (): boolean =>
  typeof BroadcastChannel !== 'undefined';
