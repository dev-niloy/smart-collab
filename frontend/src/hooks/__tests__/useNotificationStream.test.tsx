import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNotificationStream } from '../useNotificationStream';

// Minimal fake EventSource. Tests drive it directly via .__fire('event', payload).
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static reset(): void {
    FakeEventSource.instances = [];
  }
  url: string;
  withCredentials: boolean;
  readyState = 0;
  private listeners = new Map<string, Set<(ev: MessageEvent) => void>>();
  closed = false;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, cb: (ev: MessageEvent) => void): void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(cb);
  }
  removeEventListener(name: string, cb: (ev: MessageEvent) => void): void {
    this.listeners.get(name)?.delete(cb);
  }
  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
  __fire(name: string, data?: unknown): void {
    const set = this.listeners.get(name);
    if (!set) return;
    const ev = { data: data === undefined ? '' : JSON.stringify(data) } as MessageEvent;
    set.forEach((cb) => cb(ev));
  }
}

const makeWrapper = (qc: QueryClient) => {
  const W = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  W.displayName = 'QC';
  return W;
};

describe('useNotificationStream', () => {
  beforeEach(() => {
    FakeEventSource.reset();
  });

  it('opens an EventSource to the stream path with credentials', () => {
    const qc = new QueryClient();
    renderHook(
      () =>
        useNotificationStream({
          EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        }),
      { wrapper: makeWrapper(qc) },
    );
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('/api/v1/notifications/stream');
    expect(FakeEventSource.instances[0].withCredentials).toBe(true);
  });

  it('transitions status idle → connecting → open on open event', async () => {
    const qc = new QueryClient();
    const { result } = renderHook(
      () =>
        useNotificationStream({
          EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.status).toBe('connecting'));
    act(() => {
      FakeEventSource.instances[0].__fire('open');
    });
    expect(result.current.status).toBe('open');
  });

  it('invalidates ["notifications"] query keys on a notification event', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(
      () =>
        useNotificationStream({
          EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        }),
      { wrapper: makeWrapper(qc) },
    );
    act(() => {
      FakeEventSource.instances[0].__fire('notification', { id: 'n-1' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('closes EventSource and stops on unmount', () => {
    const qc = new QueryClient();
    const { unmount } = renderHook(
      () =>
        useNotificationStream({
          EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        }),
      { wrapper: makeWrapper(qc) },
    );
    expect(FakeEventSource.instances[0].closed).toBe(false);
    unmount();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('skips connecting when enabled=false', () => {
    const qc = new QueryClient();
    renderHook(
      () =>
        useNotificationStream({
          enabled: false,
          EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        }),
      { wrapper: makeWrapper(qc) },
    );
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('reconnects with backoff after an error frame', async () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    renderHook(
      () =>
        useNotificationStream({
          EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
        }),
      { wrapper: makeWrapper(qc) },
    );
    act(() => {
      FakeEventSource.instances[0].__fire('error');
    });
    expect(FakeEventSource.instances[0].closed).toBe(true);
    // First backoff is 1000ms (INITIAL_BACKOFF_MS).
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it('is a no-op when EventSource is unavailable globally', () => {
    const qc = new QueryClient();
    // No EventSourceImpl injected; jsdom does not expose EventSource by default.
    const { result } = renderHook(() => useNotificationStream(), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current.status).toBe('idle');
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
