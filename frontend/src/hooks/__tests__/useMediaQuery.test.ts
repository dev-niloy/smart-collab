import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

interface MockMQL {
  matches: boolean;
  media: string;
  listener: ((e: MediaQueryListEvent) => void) | null;
  addEventListener: (type: string, l: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: string, l: (e: MediaQueryListEvent) => void) => void;
  addListener: (l: (e: MediaQueryListEvent) => void) => void;
  removeListener: (l: (e: MediaQueryListEvent) => void) => void;
}

const createMQL = (matches: boolean): MockMQL => {
  const mql: MockMQL = {
    matches,
    media: '',
    listener: null,
    addEventListener: vi.fn((_t, l) => {
      mql.listener = l;
    }),
    removeEventListener: vi.fn(() => {
      mql.listener = null;
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
  return mql;
};

describe('useMediaQuery', () => {
  let mqls: MockMQL[] = [];

  beforeEach(() => {
    mqls = [];
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => {
        const mql = createMQL(query.includes('max-width: 767'));
        mql.media = query;
        mqls.push(mql);
        return mql;
      },
    });
  });

  it('returns the initial match value from matchMedia', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(true);

    const { result: desktop } = renderHook(() => useMediaQuery('(min-width: 1200px)'));
    expect(desktop.current).toBe(false);
  });

  it('updates when the media query reports a change', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1200px)'));
    expect(result.current).toBe(false);

    act(() => {
      const mql = mqls[mqls.length - 1]!;
      mql.matches = true;
      mql.listener?.({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });
});
