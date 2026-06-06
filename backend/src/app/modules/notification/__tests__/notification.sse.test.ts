import { EventEmitter } from 'node:events';
import {
  publishNotificationCreated,
  sseHandler,
  subscribe,
  type SSENotificationPayload,
} from '../notification.sse';

const samplePayload = (overrides: Partial<SSENotificationPayload> = {}): SSENotificationPayload => ({
  id: 'n-1',
  type: 'comment.mention',
  actorId: 'a-1',
  entityType: 'comment',
  entityId: 'c-1',
  projectId: 'p-1',
  payload: { taskTitle: 'Ship' },
  createdAt: new Date('2026-06-06T18:00:00Z').toISOString(),
  ...overrides,
});

describe('notification.sse bus', () => {
  it('subscribe + publish delivers payload to the matching recipient', () => {
    const received: SSENotificationPayload[] = [];
    const off = subscribe('u-1', (p) => received.push(p));
    publishNotificationCreated('u-1', samplePayload());
    off();
    expect(received).toHaveLength(1);
    expect(received[0].id).toBe('n-1');
  });

  it('does NOT deliver to non-matching recipient channels', () => {
    const received: SSENotificationPayload[] = [];
    const off = subscribe('u-2', (p) => received.push(p));
    publishNotificationCreated('u-1', samplePayload());
    off();
    expect(received).toHaveLength(0);
  });

  it('unsubscribe stops further events', () => {
    const received: SSENotificationPayload[] = [];
    const off = subscribe('u-1', (p) => received.push(p));
    publishNotificationCreated('u-1', samplePayload());
    off();
    publishNotificationCreated('u-1', samplePayload({ id: 'n-2' }));
    expect(received).toHaveLength(1);
  });

  it('supports multiple subscribers on the same recipient channel', () => {
    const a: SSENotificationPayload[] = [];
    const b: SSENotificationPayload[] = [];
    const offA = subscribe('u-1', (p) => a.push(p));
    const offB = subscribe('u-1', (p) => b.push(p));
    publishNotificationCreated('u-1', samplePayload());
    offA();
    offB();
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});

// Lightweight req/res fakes — enough surface area to drive the SSE handler
// without booting Express. The handler only touches setHeader, flushHeaders,
// write, status, json, and the close events on req/res.
const makeReqRes = (userId: string | null) => {
  const req = new EventEmitter() as EventEmitter & { user?: { id: string } };
  if (userId) req.user = { id: userId };
  const headers: Record<string, string> = {};
  const writes: string[] = [];
  let statusCode = 200;
  let jsonBody: unknown = null;
  const res = new EventEmitter() as EventEmitter & {
    setHeader: (k: string, v: string) => void;
    flushHeaders?: () => void;
    write: (chunk: string) => void;
    status: (n: number) => typeof res;
    json: (b: unknown) => typeof res;
    getHeaders: () => Record<string, string>;
    getWrites: () => string[];
    getStatus: () => number;
    getJson: () => unknown;
  };
  res.setHeader = (k, v) => {
    headers[k] = v;
  };
  res.flushHeaders = () => undefined;
  res.write = (chunk: string) => {
    writes.push(chunk);
  };
  res.status = (n: number) => {
    statusCode = n;
    return res;
  };
  res.json = (b: unknown) => {
    jsonBody = b;
    return res;
  };
  res.getHeaders = () => headers;
  res.getWrites = () => writes;
  res.getStatus = () => statusCode;
  res.getJson = () => jsonBody;
  return { req, res };
};

describe('sseHandler', () => {
  it('rejects with 401 when no req.user', () => {
    const { req, res } = makeReqRes(null);
    sseHandler()(req as never, res as never);
    expect(res.getStatus()).toBe(401);
    expect(res.getJson()).toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });

  it('sets SSE response headers + writes an open frame', () => {
    const { req, res } = makeReqRes('u-1');
    sseHandler({ heartbeatMs: 60_000 })(req as never, res as never);
    expect(res.getHeaders()['Content-Type']).toBe('text/event-stream');
    expect(res.getHeaders()['Cache-Control']).toBe('no-cache, no-transform');
    expect(res.getHeaders()['Connection']).toBe('keep-alive');
    const writes = res.getWrites().join('');
    expect(writes).toContain('event: open');
    expect(writes).toContain('"recipientId":"u-1"');
    req.emit('close');
  });

  it('writes a notification frame when the injected subscribe fires', () => {
    const { req, res } = makeReqRes('u-1');
    let handler: ((p: SSENotificationPayload) => void) | null = null;
    const customSubscribe = jest.fn((_id: string, h: (p: SSENotificationPayload) => void) => {
      handler = h;
      return () => undefined;
    });
    sseHandler({ subscribe: customSubscribe, heartbeatMs: 60_000 })(
      req as never,
      res as never,
    );
    expect(customSubscribe).toHaveBeenCalledWith('u-1', expect.any(Function));
    handler!(samplePayload());
    const writes = res.getWrites().join('');
    expect(writes).toContain('event: notification');
    expect(writes).toContain('"id":"n-1"');
    req.emit('close');
  });

  it('unsubscribes + clears heartbeat on connection close', () => {
    const { req, res } = makeReqRes('u-1');
    const unsubscribe = jest.fn();
    const customSubscribe = jest.fn(() => unsubscribe);
    sseHandler({ subscribe: customSubscribe, heartbeatMs: 60_000 })(
      req as never,
      res as never,
    );
    req.emit('close');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('writes a heartbeat ping line at the configured interval', () => {
    jest.useFakeTimers();
    const { req, res } = makeReqRes('u-1');
    sseHandler({ subscribe: () => () => undefined, heartbeatMs: 1_000 })(
      req as never,
      res as never,
    );
    jest.advanceTimersByTime(1_000);
    const writes = res.getWrites();
    expect(writes.some((w) => w.startsWith(': ping'))).toBe(true);
    req.emit('close');
    jest.useRealTimers();
  });
});
