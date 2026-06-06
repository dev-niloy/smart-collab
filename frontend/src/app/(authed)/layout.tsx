'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  ShellLayout,
  RailBottom,
  ProjectsPanel,
  DashboardPanel,
  InboxPanel,
} from '@/components/shell';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { pickPanel, type PanelMap } from '@/components/shell/routeToPanel';
import { useNotificationStream } from '@/hooks/useNotificationStream';

const PANELS: PanelMap = {
  dashboard: <DashboardPanel />,
  projects: <ProjectsPanel />,
  inbox: <InboxPanel />,
};

export default function AuthedLayout({ children }: { children: ReactNode }) {
  // Live notification push for the whole authed shell. Polling stays as
  // fallback, so this only ever shortens the wait between event + UI update.
  useNotificationStream();
  const pathname = usePathname();
  const panel = pickPanel(pathname, PANELS);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <>
      <ShellLayout
        panel={panel}
        railBottom={<RailBottom />}
        onSearchClick={() => setPaletteOpen(true)}
      >
        {children}
      </ShellLayout>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
