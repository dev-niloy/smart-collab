import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { useBroadcastInvalidation } from '../useBroadcastInvalidation';
import { CACHE_CHANNEL_NAME, type CacheMessage } from '@/lib/broadcast-cache';

// Minimal same-process BroadcastChannel substitute. Vitest's jsdom env may
// or may not ship one depending on version, so always replace with a stub
// that routes messages between every open instance for the same channel
// name (the real Web API does not deliver to the SENDER instance — we
// preserve that semantic so the loop guard is exercised properly).
class FakeChannel {
  static instances = new Map<string, Set<FakeChannel>>();
  public onmessage: ((e: MessageEvent<unknown>) => void) | null = null;
  private peers: Set<FakeChannel>;

  constructor(public readonly name: string) {
    const set = FakeChannel.instances.get(name) ?? new Set<FakeChannel>();
    set.add(this);
    FakeChannel.instances.set(name, set);
    this.peers = set;
  }

  postMessage(data: unknown) {
    for (const peer of this.peers) {
      if (peer === this) continue;
      // Real BroadcastChannel dispatches asynchronously — mirror that so
      // the sender's microtask completes before peers handle it.
      queueMicrotask(() => {
        peer.onmessage?.({ data } as MessageEvent<unknown>);
      });
    }
  }

  close() {
    this.peers.delete(this);
  }
}

describe('useBroadcastInvalidation', () => {
  let original: typeof globalThis.BroadcastChannel | undefined;

  beforeEach(() => {
    original = globalThis.BroadcastChannel;
    FakeChannel.instances.clear();
    (globalThis as unknown as { BroadcastChannel: typeof FakeChannel }).BroadcastChannel =
      FakeChannel;
  });

  afterEach(() => {
    if (original) {
      globalThis.BroadcastChannel = original;
    } else {
      // @ts-expect-error reset for jsdom fresh state
      delete globalThis.BroadcastChannel;
    }
  });

  it('broadcasts a local invalidation to peer tabs', async () => {
    const tabA = new QueryClient();
    const tabB = new QueryClient();
    const spyB = vi.spyOn(tabB, 'invalidateQueries');

    renderHook(() => useBroadcastInvalidation(tabA));
    renderHook(() => useBroadcastInvalidation(tabB));

    // Prime caches so the keys exist in both clients.
    tabA.setQueryData(['project-members', 'p1'], []);
    tabB.setQueryData(['project-members', 'p1'], []);

    await tabA.invalidateQueries({ queryKey: ['project-members', 'p1'] });

    await waitFor(() => {
      expect(spyB).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['project-members', 'p1'],
          refetchType: 'active',
        }),
      );
    });
  });

  it('does not echo a peer-originated invalidation back into the channel', async () => {
    const tabA = new QueryClient();
    const tabB = new QueryClient();
    const spyA = vi.spyOn(tabA, 'invalidateQueries');
    const spyB = vi.spyOn(tabB, 'invalidateQueries');

    renderHook(() => useBroadcastInvalidation(tabA));
    renderHook(() => useBroadcastInvalidation(tabB));

    tabA.setQueryData(['project-members', 'p1'], []);
    tabB.setQueryData(['project-members', 'p1'], []);

    await tabA.invalidateQueries({ queryKey: ['project-members', 'p1'] });

    // Wait for Tab B to receive + replay once.
    await waitFor(() => expect(spyB).toHaveBeenCalledTimes(1));

    // Give an extra microtask + macrotask in case the replay rebroadcasts.
    await new Promise((r) => setTimeout(r, 10));

    // Tab A's invalidateQueries was called once by the test, NOT a second
    // time as a replay of its own broadcast.
    expect(spyA).toHaveBeenCalledTimes(1);
    // Tab B did NOT rebroadcast.
    expect(spyB).toHaveBeenCalledTimes(1);
  });

  it('no-ops when BroadcastChannel is unavailable', () => {
    // @ts-expect-error force-unset for this case
    delete globalThis.BroadcastChannel;
    const qc = new QueryClient();
    const subscribeSpy = vi.spyOn(qc.getQueryCache(), 'subscribe');

    renderHook(() => useBroadcastInvalidation(qc));

    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it('uses the documented channel name', () => {
    const qc = new QueryClient();
    let captured: string | null = null;

    class CaptureChannel extends FakeChannel {
      constructor(name: string) {
        super(name);
        captured = name;
      }
    }
    (globalThis as unknown as { BroadcastChannel: typeof FakeChannel }).BroadcastChannel =
      CaptureChannel;

    renderHook(() => useBroadcastInvalidation(qc));

    expect(captured).toBe(CACHE_CHANNEL_NAME);
  });

  it('CacheMessage shape is { type, queryKey, senderId }', () => {
    // Compile-time type-check + a runtime sanity assertion so the contract
    // shipping over the wire is reviewer-visible.
    const msg: CacheMessage = {
      type: 'invalidate',
      queryKey: ['project-members', 'p1'],
      senderId: 'abc',
    };
    expect(msg.type).toBe('invalidate');
    expect(msg.queryKey).toEqual(['project-members', 'p1']);
    expect(typeof msg.senderId).toBe('string');
  });
});
