import type { BreadcrumbSegment } from './Topbar';

const STATIC_ROOTS: Record<string, BreadcrumbSegment[]> = {
  '/dashboard': [{ label: 'Dashboard' }],
  '/dashboard/my-tasks': [{ label: 'Dashboard', href: '/dashboard' }, { label: 'My open tasks' }],
  '/dashboard/deadlines': [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Upcoming deadlines' }],
  '/projects': [{ label: 'Projects' }],
  '/projects/new': [{ label: 'Projects', href: '/projects' }, { label: 'New' }],
  '/inbox': [{ label: 'Inbox' }],
  '/profile': [{ label: 'Profile' }],
  '/profile/notifications': [{ label: 'Profile', href: '/profile' }, { label: 'Notifications' }],
  '/profile/password': [{ label: 'Profile', href: '/profile' }, { label: 'Password' }],
};

export interface CrumbContext {
  projectName?: string;
  taskTitle?: string;
}

const truncate = (s: string, max = 32): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Maps a pathname to topbar breadcrumb segments. Project subroutes follow:
 *   Projects → <project name> → <leaf>
 * Names are passed in via ctx so the layout can resolve them via hooks.
 */
export const pathToCrumbs = (
  pathname: string | null,
  ctx: CrumbContext = {},
): BreadcrumbSegment[] => {
  if (!pathname) return [];
  const exact = STATIC_ROOTS[pathname];
  if (exact) return exact;

  // /projects/:id and below
  const m = pathname.match(/^\/projects\/([^/]+)(?:\/(.*))?$/);
  if (m) {
    const id = m[1];
    const rest = m[2] ?? '';
    const projectLabel = ctx.projectName ? truncate(ctx.projectName) : 'Project';
    const taskLabel = ctx.taskTitle ? truncate(ctx.taskTitle) : 'Task';
    const base: BreadcrumbSegment[] = [
      { label: 'Projects', href: '/projects' },
      { label: projectLabel, href: `/projects/${id}` },
    ];
    if (!rest) return [{ label: 'Projects', href: '/projects' }, { label: projectLabel }];
    if (rest === 'edit') return [...base, { label: 'Edit' }];
    if (rest === 'members') return [...base, { label: 'Members' }];
    if (rest === 'activity') return [...base, { label: 'Activity' }];
    if (rest === 'dashboard') return [...base, { label: 'Dashboard' }];
    if (rest === 'tasks') return [...base, { label: 'Tasks' }];
    if (rest === 'tasks/new') return [...base, { label: 'Tasks', href: `/projects/${id}/tasks` }, { label: 'New' }];
    const tm = rest.match(/^tasks\/([^/]+)(?:\/(.*))?$/);
    if (tm) {
      const tail = tm[2] ?? '';
      const t: BreadcrumbSegment[] = [
        ...base,
        { label: 'Tasks', href: `/projects/${id}/tasks` },
        tail === '' ? { label: taskLabel } : { label: taskLabel, href: `/projects/${id}/tasks/${tm[1]}` },
      ];
      if (tail === 'edit') t.push({ label: 'Edit' });
      return t;
    }
    return base;
  }

  return [];
};
