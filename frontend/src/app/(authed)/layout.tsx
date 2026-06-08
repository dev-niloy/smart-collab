'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
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

  return (
    <>
      <ShellLayout
        panel={panel}
        railBottom={<RailBottom />}
        topbar={<Topbar segments={crumbs} />}
        onSearchClick={() => setPaletteOpen(true)}
      >
        {children}
      </ShellLayout>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
