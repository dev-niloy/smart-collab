'use client';

import { useEffect } from 'react';
import type { QueryClient, QueryCacheNotifyEvent } from '@tanstack/react-query';
import {
  CACHE_CHANNEL_NAME,
  isBroadcastChannelSupported,
  serializeKey,
  type CacheMessage,
} from '@/lib/broadcast-cache';

const newSenderId = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const isInvalidateEvent = (
  event: QueryCacheNotifyEvent,
): event is QueryCacheNotifyEvent & { action: { type: 'invalidate' } } =>
  event.type === 'updated' &&
  (event as { action?: { type?: string } }).action?.type === 'invalidate';

/**
 * Subscribe a `QueryClient` to a same-origin `BroadcastChannel` so that
 * `invalidateQueries` calls in one tab replay in every other open tab.
 *
 * No-ops when `BroadcastChannel` is unavailable (older Safari, SSR, jsdom
 * without the polyfill); same-tab invalidation still works because the
 * mutation hooks already call `qc.invalidateQueries` directly.
 */
export function useBroadcastInvalidation(client: QueryClient): void {
  useEffect(() => {
    if (!isBroadcastChannelSupported()) return;

    const senderId = newSenderId();
    const channel = new BroadcastChannel(CACHE_CHANNEL_NAME);
    // Keys we are currently replaying from a peer message — guards the
    // local cache subscription against re-broadcasting and creating a loop.
    const replaying = new Set<string>();

    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (!isInvalidateEvent(event)) return;
      const key = event.query.queryKey;
      const k = serializeKey(key);
      if (replaying.has(k)) return;
      const message: CacheMessage = { type: 'invalidate', queryKey: key, senderId };
      try {
        channel.postMessage(message);
      } catch {
        // Channel closed mid-flight — let the cleanup teardown handle it.
      }
    });

    channel.onmessage = (e: MessageEvent<CacheMessage>) => {
      const msg = e.data;
      if (!msg || msg.type !== 'invalidate' || msg.senderId === senderId) return;
      const k = serializeKey(msg.queryKey);
      replaying.add(k);
      void client
        .invalidateQueries({ queryKey: msg.queryKey, refetchType: 'active' })
        .finally(() => {
          replaying.delete(k);
        });
    };

    return () => {
      unsubscribe();
      channel.close();
    };
  }, [client]);
}
