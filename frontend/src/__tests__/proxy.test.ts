import { describe, it, expect, vi } from 'vitest';
import { proxy } from '../proxy';

// Capture NextResponse.redirect calls by mocking the module surface we use.
const redirectMock = vi.fn((url: URL) => ({ type: 'redirect' as const, location: url.toString() }));
const nextMock = vi.fn(() => ({ type: 'next' as const }));

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => redirectMock(url),
    next: () => nextMock(),
  },
}));

type CookieJar = Record<string, string>;

function makeReq(pathname: string, cookies: CookieJar = {}) {
  const url = new URL(`http://localhost:3000${pathname}`);
  return {
    nextUrl: {
      pathname,
      searchParams: url.searchParams,
      // Clone returns a real URL so pathname/searchParams writes round-trip via toString().
      clone: () => new URL(url.toString()),
    },
    cookies: {
      has: (k: string) => k in cookies,
    },
  } as unknown as Parameters<typeof proxy>[0];
}

describe('proxy (auth-aware redirects)', () => {
  it.each([
    ['/dashboard', '/login'],
    ['/projects', '/login'],
    ['/projects/abc-123', '/login'],
    ['/tasks', '/login'],
    ['/team', '/login'],
    ['/inbox', '/login'],
  ])('unauthed visit to %s redirects to /login', (path) => {
    redirectMock.mockClear();
    proxy(makeReq(path));
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const arg = redirectMock.mock.calls[0]![0] as { toString(): string };
    const loc = arg.toString();
    expect(loc).toContain('/login');
    expect(loc).toContain(`next=${encodeURIComponent(path)}`);
  });

  it.each([
    ['/login'],
    ['/signup'],
  ])('authed visit to %s redirects to /dashboard', (path) => {
    redirectMock.mockClear();
    proxy(makeReq(path, { sc_at: 'jwt' }));
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const loc = (redirectMock.mock.calls[0]![0] as { toString(): string }).toString();
    expect(loc).toContain('/dashboard');
  });

  it('passes through public root path / when unauthed', () => {
    nextMock.mockClear();
    redirectMock.mockClear();
    proxy(makeReq('/'));
    expect(redirectMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it('passes through protected path when authed', () => {
    nextMock.mockClear();
    redirectMock.mockClear();
    proxy(makeReq('/dashboard', { sc_at: 'jwt' }));
    expect(redirectMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it('considers refresh-cookie alone enough to be authed', () => {
    nextMock.mockClear();
    redirectMock.mockClear();
    proxy(makeReq('/dashboard', { sc_rt: 'jwt' }));
    expect(redirectMock).not.toHaveBeenCalled();
    expect(nextMock).toHaveBeenCalledTimes(1);
  });
});
