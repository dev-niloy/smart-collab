import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePanelCollapsed, PANEL_COLLAPSED_STORAGE_KEY } from '../usePanelCollapsed';

describe('usePanelCollapsed', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to false when nothing in localStorage', () => {
    const { result } = renderHook(() => usePanelCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it('hydrates from localStorage on mount when value is "true"', () => {
    window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, 'true');
    const { result } = renderHook(() => usePanelCollapsed());
    expect(result.current.collapsed).toBe(true);
  });

  it('hydrates from localStorage on mount when value is "false"', () => {
    window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, 'false');
    const { result } = renderHook(() => usePanelCollapsed(true));
    // initial=true, but stored value is "false" → false wins after hydration
    expect(result.current.collapsed).toBe(false);
  });

  it('setCollapsed updates state and persists to localStorage', () => {
    const { result } = renderHook(() => usePanelCollapsed());
    act(() => result.current.setCollapsed(true));
    expect(result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY)).toBe('true');

    act(() => result.current.setCollapsed(false));
    expect(result.current.collapsed).toBe(false);
    expect(window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY)).toBe('false');
  });

  it('toggle flips current value and persists', () => {
    const { result } = renderHook(() => usePanelCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY)).toBe('true');

    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
    expect(window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY)).toBe('false');
  });

  it('ignores garbage values in localStorage', () => {
    window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, 'maybe');
    const { result } = renderHook(() => usePanelCollapsed());
    // garbage → keep initial (false)
    expect(result.current.collapsed).toBe(false);
  });
});
