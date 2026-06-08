'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  ShellLayout,
  RailBottom,
  ProjectsPanel,
  DashboardPanel,
  InboxPanel,
  ProfilePanel,
  Topbar,
} from '@/components/shell';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { pickPanel, type PanelMap } from '@/components/shell/routeToPanel';
import { pathToCrumbs } from '@/components/shell/pathToCrumbs';
import { useNotificationStream } from '@/hooks/useNotificationStream';
import { useProject } from '@/hooks/useProjects';
import { useTask } from '@/hooks/useTasks';

const extractIds = (pathname: string | null): { projectId?: string; taskId?: string } => {
  if (!pathname) return {};
  const m = pathname.match(/^\/projects\/([^/]+)(?:\/tasks\/([^/]+))?/);
  if (!m) return {};
  return { projectId: m[1], taskId: m[2] };
};

// Where to navigate back from common nested routes.
const pickBackHref = (
  pathname: string | null,
  ids: { projectId?: string; taskId?: string },
): string | null => {
  if (!pathname) return null;
  if (ids.projectId && ids.taskId) return `/projects/${ids.projectId}/tasks`;
  if (
    ids.projectId &&
    /^\/projects\/[^/]+\/(tasks|members|activity|edit|dashboard)/.test(pathname)
  ) {
    return `/projects/${ids.projectId}`;
  }
  if (ids.projectId && /^\/projects\/[^/]+$/.test(pathname)) return '/projects';
  return null;
};

const PANELS: PanelMap = {
  dashboard: <DashboardPanel />,
  projects: <ProjectsPanel />,
  inbox: <InboxPanel />,
  profile: <ProfilePanel />,
};

export default function AuthedLayout({ children }: { children: ReactNode }) {
  // Live notification push for the whole authed shell. Polling stays as
  // fallback, so this only ever shortens the wait between event + UI update.
  useNotificationStream();
  const pathname = usePathname();
  const panel = pickPanel(pathname, PANELS);
  const { projectId, taskId } = extractIds(pathname);
  const projectQuery = useProject(projectId);
  const taskQuery = useTask(taskId);
  const crumbs = pathToCrumbs(pathname, {
    projectName: projectQuery.data?.name,
    taskTitle: taskQuery.data?.title,
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  const backHref = pickBackHref(pathname, { projectId, taskId });

  return (
    <>
      <ShellLayout
        panel={panel}
        railBottom={<RailBottom />}
        topbar={
          <Topbar
            segments={crumbs}
            leading={
              backHref ? (
                <Link
                  href={backHref}
                  aria-label="Back"
                  className="mr-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </Link>
              ) : null
            }
          />
        }
        onSearchClick={() => setPaletteOpen(true)}
      >
        {children}
      </ShellLayout>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
