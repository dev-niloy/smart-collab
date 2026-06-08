import type { ReactNode } from 'react';

/**
 * Maps a Next.js pathname to the panel component key that should render in the
 * shell's secondary panel. Prefix-matched in declaration order so the most
 * specific prefix wins (mirror Rail's active-route rule).
 */
export type PanelKey = 'dashboard' | 'projects' | 'inbox' | 'profile' | null;

const ROUTES: { prefix: string; key: PanelKey }[] = [
  { prefix: '/projects', key: 'projects' },
  { prefix: '/dashboard', key: 'dashboard' },
  { prefix: '/inbox', key: 'inbox' },
  { prefix: '/profile', key: 'profile' },
];

export const getPanelKey = (pathname: string | null): PanelKey => {
  if (!pathname) return null;
  for (const route of ROUTES) {
    if (pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) {
      return route.key;
    }
  }
  return null;
};

export type PanelMap = Partial<Record<NonNullable<PanelKey>, ReactNode>>;

export const pickPanel = (pathname: string | null, panels: PanelMap): ReactNode => {
  const key = getPanelKey(pathname);
  if (!key) return null;
  return panels[key] ?? null;
};
