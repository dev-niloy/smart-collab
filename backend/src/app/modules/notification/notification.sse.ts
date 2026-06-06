// Server-Sent Events transport for live notification delivery.
//
// Pipeline:
//   1. notification.service.enqueue creates the DB row inside a tx.
//   2. Immediately after the create, it calls publishNotificationCreated()
//      so any open SSE connection for that recipient gets a `notification`
//      event with the row payload.
//   3. The /stream endpoint registers per-connection listeners against an
//      in-process EventEmitter, writes SSE frames, and heartbeats every 25s
//      to defeat idle-timeout proxies (Render etc).
//
// Trade-off acknowledged in board likely_misfire #2: an enqueue inside a tx
// that later rolls back will still have fired an SSE event. The client sees
// a "phantom" notification that vanishes on its next poll refresh — better
// than missing real ones. A proper transactional outbox is deferred.

import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';

export type SSENotificationPayload = {
  id: string;
  type: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  projectId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

const channelFor = (recipientId: string): string => `user:${recipientId}`;

// Bus is process-scoped. Multi-instance deployments would need a shared
// transport (Redis pub/sub) — left as a follow-up; sticky routing keeps
// this safe under a single-instance Render web service.
const bus = new EventEmitter();
// SSE fan-out can plausibly hit several hundred subscribers under high
// activity; lift the default-10 listener cap to suppress Node's warning
// without disabling all bounds.
bus.setMaxListeners(0);

export const publishNotificationCreated = (
  recipientId: string,
  payload: SSENotificationPayload,
): void => {
  bus.emit(channelFor(recipientId), payload);
};

export type Unsubscribe = () => void;

export const subscribe = (
  recipientId: string,
  handler: (payload: SSENotificationPayload) => void,
): Unsubscribe => {
  const ch = channelFor(recipientId);
  bus.on(ch, handler);
  return () => {
    bus.off(ch, handler);
  };
};

// Heartbeat interval — chosen at 25s because Render's free-plan request
// idle timeout is 60s and CloudFlare-style proxies often kill at 90s. A
// comment frame counts as activity for both.
export const HEARTBEAT_INTERVAL_MS = 25_000;

const writeFrame = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Test seam: tests inject a custom subscribe + heartbeat duration to keep
// the suite fast and deterministic without mocking the bus globally.
export type SseDeps = {
  subscribe?: typeof subscribe;
  heartbeatMs?: number;
};

export const sseHandler = (deps: SseDeps = {}) => {
  const sub = deps.subscribe ?? subscribe;
  const heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;

  return (req: Request, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/reverse-proxy buffering
    res.flushHeaders?.();

    // Initial frame so the client knows the channel is live before its
    // first real notification arrives.
    writeFrame(res, 'open', { recipientId: req.user.id });

    const unsubscribe = sub(req.user.id, (payload) => {
      writeFrame(res, 'notification', payload);
    });

    const heartbeat = setInterval(() => {
      // Comment-frame heartbeat — invisible to EventSource consumers,
      // counts as traffic for proxies.
      res.write(`: ping ${Date.now()}\n\n`);
    }, heartbeatMs);
    // Don't keep the process alive just for the heartbeat timer.
    heartbeat.unref?.();

    const cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    req.on('close', cleanup);
    res.on('close', cleanup);
  };
};
