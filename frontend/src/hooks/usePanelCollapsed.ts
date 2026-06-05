'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'sc:panel:collapsed';

/**
 * Local-only persistent boolean for the sidebar panel collapse state.
 * Reads from localStorage on mount, writes on every change. SSR-safe: returns
 * the `initial` value during the first render and hydrates on the client.
 */
export function usePanelCollapsed(initial = false) {
  const [collapsed, setCollapsedState] = useState<boolean>(initial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'true') setCollapsedState(true);
    else if (raw === 'false') setCollapsedState(false);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  return { collapsed, setCollapsed, toggle };
}

export const PANEL_COLLAPSED_STORAGE_KEY = STORAGE_KEY;
