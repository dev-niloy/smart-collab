'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Live notification stream via Server-Sent Events.
 *
 * Connects to GET /api/v1/notifications/stream on the same Next.js origin
 * (the existing rewrite forwards to the backend so the auth cookie rides
 * along first-party). Each 'notification' frame invalidates the notification
 * react-query keys so {@link useNotifications} + {@link useUnreadCount} pull
 * fresh data without waiting on the 30s polling cadence.
 *
 * Reconnects with exponential backoff (capped) when the connection drops —
 * SSE consumers normally rely on EventSource's built-in retry, but we layer
 * an explicit backoff on top so a sustained outage doesn't hammer the server.
 *
 * The hook is a no-op on the server and in environments without EventSource
 * (older test runners, RSC). Polling continues to provide fallback coverage.
 */

const STREAM_PATH = '/api/v1/notifications/stream';
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'closed';

export type UseNotificationStreamOptions = {
  enabled?: boolean;
  // Test seam: lets unit tests inject a fake EventSource constructor without
  // monkey-patching globals.
  EventSourceImpl?: typeof EventSource;
  url?: string;
};

export const useNotificationStream = (
  opts: UseNotificationStreamOptions = {},
): { status: StreamStatus } => {
  const enabled = opts.enabled ?? true;
  const qc = useQueryClient();
  const [status, setStatus] = useState<StreamStatus>('idle');
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ESImpl =
      opts.EventSourceImpl ??
      (typeof window !== 'undefined'
        ? (window as Window & { EventSource?: typeof EventSource }).EventSource
        : undefined);
    if (!ESImpl) return; // No SSE support — polling stays as fallback.

    const url = opts.url ?? STREAM_PATH;
    let cancelled = false;

    const connect = (): void => {
      if (cancelled) return;
      setStatus('connecting');
      const es = new ESImpl(url, { withCredentials: true });
      esRef.current = es;

      es.addEventListener('open', () => {
        backoffRef.current = INITIAL_BACKOFF_MS;
        setStatus('open');
      });

      es.addEventListener('notification', () => {
        // Invalidate everything keyed by ['notifications', ...]. The
        // useNotifications hook + unread-count both use this prefix.
        qc.invalidateQueries({ queryKey: ['notifications'] });
      });

      es.addEventListener('error', () => {
        // EventSource transitions to readyState 2 on permanent close OR
        // returns to 0 (connecting) on transient. We always force a close
        // and schedule our own reconnect — predictable behavior wins over
        // the browser's variable built-in retry.
        es.close();
        esRef.current = null;
        setStatus('closed');
        if (cancelled) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
        reconnectTimer.current = setTimeout(connect, delay);
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
      esRef.current?.close();
      esRef.current = null;
      setStatus('idle');
    };
  }, [enabled, qc, opts.EventSourceImpl, opts.url]);

  return { status };
};
